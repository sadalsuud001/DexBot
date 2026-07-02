use sha2::{Digest, Sha256};
use uuid::Uuid;

use axum::{
    extract::{Path, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use sea_orm::{
    ConnectionTrait, Database, DatabaseConnection, DbBackend, DbErr, QueryResult, Statement,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{env, net::SocketAddr};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

#[derive(Clone)]
struct AppState {
    db: DatabaseConnection,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

#[derive(Serialize, Deserialize)]
struct RobotDto {
    id: String,
    serial_number: String,
    name: String,
    model: String,
    firmware_version: String,
    ip_address: Option<String>,
    connection_status: String,
    config: serde_json::Value,
    certificate_expires_at: String,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct CreateRobotRequest {
    serial_number: String,
    name: String,
    model: String,
    firmware_version: String,
    ip_address: Option<String>,
    connection_status: Option<String>,
    config: Option<serde_json::Value>,
    certificate_valid_days: Option<i32>,
}

#[derive(Deserialize)]
struct UpdateRobotStatusRequest {
    connection_status: String,
}

#[derive(Deserialize)]
struct RenewCertificateRequest {
    days: Option<i32>,
}

#[derive(Serialize, Deserialize)]
struct RobotApiKeyDto {
    id: String,
    robot_id: String,
    name: String,
    key_fingerprint: String,
    expires_at: Option<String>,
    revoked_at: Option<String>,
    last_used_at: Option<String>,
    created_at: String,
    status: String,
}

#[derive(Deserialize)]
struct CreateRobotApiKeyRequest {
    name: String,
    expires_in_days: Option<i32>,
}

#[derive(Serialize)]
struct CreateRobotApiKeyResponse {
    api_key: RobotApiKeyDto,

    // Only returned once during create or rotate.
    plaintext_key: String,
}

#[derive(Serialize)]
struct RotateRobotApiKeyResponse {
    api_key: RobotApiKeyDto,

    // Only returned once during rotation.
    plaintext_key: String,
}

#[derive(Debug, thiserror::Error)]
enum ApiError {
    #[error("database error: {0}")]
    Db(#[from] DbErr),

    #[error("bad row data: {0}")]
    BadRow(String),

    #[error("validation error: {0}")]
    Validation(String),

    #[error("not found: {0}")]
    NotFound(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self {
            ApiError::Validation(_) => StatusCode::BAD_REQUEST,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::Db(_) | ApiError::BadRow(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = Json(json!({
            "error": {
                "code": status.as_u16(),
                "message": self.to_string()
            }
        }));

        (status, body).into_response()
    }
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL is required");

    let host = env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = env::var("API_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("API_PORT must be a number");

    let db = Database::connect(&database_url)
        .await
        .expect("failed to connect database");

    let state = AppState { db };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/robots", get(list_robots).post(create_robot))
        .route(
            "/api/robots/{id}/status",
            axum::routing::patch(update_robot_status),
        )
        .route(
            "/api/robots/{id}/renew-certificate",
            axum::routing::post(renew_certificate),
        )
        .route(
            "/api/robots/{id}/api-keys",
            get(list_robot_api_keys).post(create_robot_api_key),
        )
        .route(
            "/api/robots/{id}/api-keys/{key_id}/rotate",
            axum::routing::post(rotate_robot_api_key),
        )
        .route(
            "/api/robots/{id}/api-keys/{key_id}/revoke",
            axum::routing::post(revoke_robot_api_key),
        )
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .expect("invalid bind address");

    tracing::info!("DexBot API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind TCP listener");

    axum::serve(listener, app)
        .await
        .expect("server failed");
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "dexbot-api",
    })
}

async fn list_robots(State(state): State<AppState>) -> Result<Json<Vec<RobotDto>>, ApiError> {
    let rows = state
        .db
        .query_all(Statement::from_string(
            DbBackend::Postgres,
            robot_select_sql().to_string(),
        ))
        .await?;

    let robots = rows
        .into_iter()
        .map(row_to_robot)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(robots))
}

async fn create_robot(
    State(state): State<AppState>,
    Json(payload): Json<CreateRobotRequest>,
) -> Result<(StatusCode, Json<RobotDto>), ApiError> {
    validate_required("serial_number", &payload.serial_number)?;
    validate_required("name", &payload.name)?;
    validate_required("model", &payload.model)?;
    validate_required("firmware_version", &payload.firmware_version)?;

    let status = payload
        .connection_status
        .unwrap_or_else(|| "offline".to_string());

    validate_robot_status(&status)?;

    let certificate_valid_days = payload.certificate_valid_days.unwrap_or(365);

    if certificate_valid_days < 1 || certificate_valid_days > 1095 {
        return Err(ApiError::Validation(
            "certificate_valid_days must be between 1 and 1095".to_string(),
        ));
    }

    let ip_address = payload.ip_address.unwrap_or_default();

    let config = payload.config.unwrap_or_else(|| {
        json!({
            "capabilities": [],
            "location": "unknown"
        })
    });

    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO robots (
              serial_number,
              name,
              model,
              firmware_version,
              ip_address,
              connection_status,
              config,
              certificate_expires_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              NULLIF($5, '')::inet,
              $6,
              $7::jsonb,
              now() + ($8::int * interval '1 day')
            )
            RETURNING
              id::text,
              serial_number,
              name,
              model,
              firmware_version,
              ip_address::text AS ip_address,
              connection_status,
              config,
              certificate_expires_at::text,
              created_at::text,
              updated_at::text
            "#,
            vec![
                payload.serial_number.into(),
                payload.name.into(),
                payload.model.into(),
                payload.firmware_version.into(),
                ip_address.into(),
                status.into(),
                config.to_string().into(),
                certificate_valid_days.into(),
            ],
        ))
        .await?
        .ok_or_else(|| ApiError::BadRow("insert returned no robot".to_string()))?;

    Ok((StatusCode::CREATED, Json(row_to_robot(row)?)))
}

async fn update_robot_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRobotStatusRequest>,
) -> Result<Json<RobotDto>, ApiError> {
    validate_robot_status(&payload.connection_status)?;

    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE robots
            SET
              connection_status = $1,
              updated_at = now()
            WHERE id = $2::uuid
            RETURNING
              id::text,
              serial_number,
              name,
              model,
              firmware_version,
              ip_address::text AS ip_address,
              connection_status,
              config,
              certificate_expires_at::text,
              created_at::text,
              updated_at::text
            "#,
            vec![payload.connection_status.into(), id.into()],
        ))
        .await?
        .ok_or_else(|| ApiError::NotFound("robot not found".to_string()))?;

    Ok(Json(row_to_robot(row)?))
}

async fn list_robot_api_keys(
    State(state): State<AppState>,
    Path(robot_id): Path<String>,
) -> Result<Json<Vec<RobotApiKeyDto>>, ApiError> {
    let rows = state
        .db
        .query_all(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            SELECT
              id::text,
              robot_id::text,
              name,
              key_hash,
              expires_at::text,
              revoked_at::text,
              last_used_at::text,
              created_at::text
            FROM robot_api_keys
            WHERE robot_id = $1::uuid
            ORDER BY created_at DESC
            "#,
            vec![robot_id.into()],
        ))
        .await?;

    let keys = rows
        .into_iter()
        .map(row_to_api_key)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(keys))
}

async fn create_robot_api_key(
    State(state): State<AppState>,
    Path(robot_id): Path<String>,
    Json(payload): Json<CreateRobotApiKeyRequest>,
) -> Result<(StatusCode, Json<CreateRobotApiKeyResponse>), ApiError> {
    validate_required("name", &payload.name)?;

    let expires_in_days = payload.expires_in_days.unwrap_or(365);

    if expires_in_days < 1 || expires_in_days > 1095 {
        return Err(ApiError::Validation(
            "expires_in_days must be between 1 and 1095".to_string(),
        ));
    }

    let plaintext_key = generate_api_key();
    let key_hash = hash_api_key(&plaintext_key);

    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            INSERT INTO robot_api_keys (
              robot_id,
              name,
              key_hash,
              expires_at
            )
            VALUES (
              $1::uuid,
              $2,
              $3,
              now() + ($4::int * interval '1 day')
            )
            RETURNING
              id::text,
              robot_id::text,
              name,
              key_hash,
              expires_at::text,
              revoked_at::text,
              last_used_at::text,
              created_at::text
            "#,
            vec![
                robot_id.into(),
                payload.name.into(),
                key_hash.into(),
                expires_in_days.into(),
            ],
        ))
        .await?
        .ok_or_else(|| ApiError::BadRow("insert returned no API key".to_string()))?;

    let api_key = row_to_api_key(row)?;

    Ok((
        StatusCode::CREATED,
        Json(CreateRobotApiKeyResponse {
            api_key,
            plaintext_key,
        }),
    ))
}

async fn rotate_robot_api_key(
    State(state): State<AppState>,
    Path((robot_id, key_id)): Path<(String, String)>,
) -> Result<Json<RotateRobotApiKeyResponse>, ApiError> {
    let plaintext_key = generate_api_key();
    let key_hash = hash_api_key(&plaintext_key);

    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE robot_api_keys
            SET
              key_hash = $1
            WHERE
              id = $2::uuid
              AND robot_id = $3::uuid
              AND revoked_at IS NULL
            RETURNING
              id::text,
              robot_id::text,
              name,
              key_hash,
              expires_at::text,
              revoked_at::text,
              last_used_at::text,
              created_at::text
            "#,
            vec![key_hash.into(), key_id.into(), robot_id.into()],
        ))
        .await?
        .ok_or_else(|| ApiError::NotFound("active API key not found".to_string()))?;

    let api_key = row_to_api_key(row)?;

    Ok(Json(RotateRobotApiKeyResponse {
        api_key,
        plaintext_key,
    }))
}

async fn revoke_robot_api_key(
    State(state): State<AppState>,
    Path((robot_id, key_id)): Path<(String, String)>,
) -> Result<Json<RobotApiKeyDto>, ApiError> {
    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DbBackend::Postgres,
            r#"
            UPDATE robot_api_keys
            SET revoked_at = now()
            WHERE
              id = $1::uuid
              AND robot_id = $2::uuid
              AND revoked_at IS NULL
            RETURNING
              id::text,
              robot_id::text,
              name,
              key_hash,
              expires_at::text,
              revoked_at::text,
              last_used_at::text,
              created_at::text
            "#,
            vec![key_id.into(), robot_id.into()],
        ))
        .await?
        .ok_or_else(|| ApiError::NotFound("active API key not found".to_string()))?;

    Ok(Json(row_to_api_key(row)?))
}

fn robot_select_sql() -> &'static str {
    r#"
    SELECT
      id::text,
      serial_number,
      name,
      model,
      firmware_version,
      ip_address::text AS ip_address,
      connection_status,
      config,
      certificate_expires_at::text,
      created_at::text,
      updated_at::text
    FROM robots
    ORDER BY created_at ASC
    "#
}

fn row_to_robot(row: QueryResult) -> Result<RobotDto, ApiError> {
    Ok(RobotDto {
        id: get_string(&row, "id")?,
        serial_number: get_string(&row, "serial_number")?,
        name: get_string(&row, "name")?,
        model: get_string(&row, "model")?,
        firmware_version: get_string(&row, "firmware_version")?,
        ip_address: row.try_get("", "ip_address").ok(),
        connection_status: get_string(&row, "connection_status")?,
        config: row
            .try_get("", "config")
            .map_err(|e| ApiError::BadRow(e.to_string()))?,
        certificate_expires_at: get_string(&row, "certificate_expires_at")?,
        created_at: get_string(&row, "created_at")?,
        updated_at: get_string(&row, "updated_at")?,
    })
}

fn get_string(row: &QueryResult, column: &str) -> Result<String, ApiError> {
    row.try_get("", column)
        .map_err(|e| ApiError::BadRow(format!("column `{column}`: {e}")))
}

fn validate_required(field: &str, value: &str) -> Result<(), ApiError> {
    if value.trim().is_empty() {
        return Err(ApiError::Validation(format!("{field} is required")));
    }

    Ok(())
}

fn validate_robot_status(status: &str) -> Result<(), ApiError> {
    match status {
        "online" | "offline" | "error" => Ok(()),
        _ => Err(ApiError::Validation(
            "connection_status must be one of: online, offline, error".to_string(),
        )),
    }
}

fn row_to_api_key(row: QueryResult) -> Result<RobotApiKeyDto, ApiError> {
    let key_hash = get_string(&row, "key_hash")?;
    let revoked_at: Option<String> = row.try_get("", "revoked_at").ok();
    let expires_at: Option<String> = row.try_get("", "expires_at").ok();
    let last_used_at: Option<String> = row.try_get("", "last_used_at").ok();

    let status = if revoked_at.is_some() {
        "revoked".to_string()
    } else if let Some(expires) = &expires_at {
        if is_expired_timestamp(expires) {
            "expired".to_string()
        } else {
            "active".to_string()
        }
    } else {
        "active".to_string()
    };

    Ok(RobotApiKeyDto {
        id: get_string(&row, "id")?,
        robot_id: get_string(&row, "robot_id")?,
        name: get_string(&row, "name")?,
        key_fingerprint: fingerprint_hash(&key_hash),
        expires_at,
        revoked_at,
        last_used_at,
        created_at: get_string(&row, "created_at")?,
        status,
    })
}

fn generate_api_key() -> String {
    format!("dxb_{}", Uuid::new_v4().simple())
}

fn hash_api_key(plaintext: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(plaintext.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

fn fingerprint_hash(hash: &str) -> String {
    hash.chars().take(12).collect()
}

fn is_expired_timestamp(timestamp: &str) -> bool {
    match chrono::DateTime::parse_from_str(timestamp, "%Y-%m-%d %H:%M:%S%.f%#z") {
        Ok(expires_at) => expires_at < chrono::Utc::now(),
        Err(_) => false,
    }
}