# DexBot Demo Design

## Goal

DexBot is a fleet operations platform combining:
1. Community/content layer
2. Robot lifecycle management
3. AI-powered fleet orchestration

This demo prioritizes end-to-end working flows over production completeness.

## Demo Scope

### Deeply implemented

- JWT-based auth session
- RBAC: admin / moderator / member
- User profile
- Forum topics/replies/reactions/reports
- Wiki pages with draft/publish and versions
- Software package registry
- Robot registration and API key lifecycle
- Robot permission grants
- Certificate expiration and renewal queue
- Fleet jobs using contract-net lifecycle
- Telemetry ingestion simulator
- Operator dashboard
- Agent console with plan/tool-call/audit trail

### Simulated but functional

- Robot execution
- Telemetry stream
- Camera clip search
- Agent planning
- Email/SMS notification delivery
- SLA breach generation

### Deferred production features

- Real robot SDK integration
- Real GStreamer / FFmpeg decoding
- Full WorkOS enterprise SSO setup for every provider
- Full Kafka + Temporal hardening
- Real PagerDuty/Slack routing
- ECS/Fargate production deployment

## Architecture

Frontend:
React 19 + Vite + TypeScript + Tailwind + shadcn/ui

Core API:
Rust + Axum + SeaORM + PostgreSQL

Orchestrator:
Go service implementing contract-net job lifecycle

AI service:
Python FastAPI service for agent planning and audit traces

Storage:
PostgreSQL for relational data
TimescaleDB-style telemetry table for time-series
pgvector-compatible embeddings table for semantic search
S3/MinIO-style clip storage

Eventing:
Kafka-compatible event bus for fleet and telemetry events

## Main User Flows

1. User signs in
2. User views dashboard
3. Admin registers robot
4. Admin grants robot permission to user/group
5. Operator creates fleet job
6. Orchestrator announces job
7. Robots bid
8. Orchestrator awards job
9. Robot simulator executes job
10. Telemetry appears in dashboard
11. Agent explains incident or creates robot task
12. Audit trail is replayable