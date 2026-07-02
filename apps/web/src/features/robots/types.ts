export type RobotStatus = "online" | "offline" | "error";

export type RobotConfig = {
  capabilities?: string[];
  location?: string;
  max_payload_kg?: number;
};

export type Robot = {
  id: string;
  serial_number: string;
  name: string;
  model: string;
  firmware_version: string;
  ip_address: string | null;
  connection_status: RobotStatus;
  config: RobotConfig;
  certificate_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type CreateRobotPayload = {
  serial_number: string;
  name: string;
  model: string;
  firmware_version: string;
  ip_address?: string;
  connection_status?: RobotStatus;
  config?: RobotConfig;
  certificate_valid_days?: number;
};

export type UpdateRobotStatusPayload = {
  id: string;
  connection_status: RobotStatus;
};

export type RenewCertificatePayload = {
  id: string;
  days: number;
};

export type RobotApiKeyStatus = "active" | "revoked" | "expired";

export type RobotApiKey = {
  id: string;
  robot_id: string;
  name: string;
  key_fingerprint: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  status: RobotApiKeyStatus;
};

export type CreateRobotApiKeyPayload = {
  robotId: string;
  name: string;
  expires_in_days?: number;
};

export type CreateRobotApiKeyResponse = {
  api_key: RobotApiKey;
  plaintext_key: string;
};

export type RotateRobotApiKeyPayload = {
  robotId: string;
  keyId: string;
};

export type RotateRobotApiKeyResponse = {
  api_key: RobotApiKey;
  plaintext_key: string;
};

export type RevokeRobotApiKeyPayload = {
  robotId: string;
  keyId: string;
};