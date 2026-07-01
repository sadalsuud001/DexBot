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