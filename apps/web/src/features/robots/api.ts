import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "../../lib/api";
import type {
  CreateRobotApiKeyPayload,
  CreateRobotApiKeyResponse,
  CreateRobotPayload,
  RenewCertificatePayload,
  RevokeRobotApiKeyPayload,
  Robot,
  RobotApiKey,
  RotateRobotApiKeyPayload,
  RotateRobotApiKeyResponse,
  UpdateRobotStatusPayload,
} from "./types";

export function useRobots() {
  return useQuery({
    queryKey: ["robots"],
    queryFn: () => apiGet<Robot[]>("/api/robots"),
    refetchInterval: 5000,
  });
}

export function useCreateRobot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRobotPayload) =>
      apiPost<Robot, CreateRobotPayload>("/api/robots", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robots"] });
    },
  });
}

export function useUpdateRobotStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateRobotStatusPayload) =>
      apiPatch<Robot, { connection_status: string }>(
        `/api/robots/${payload.id}/status`,
        {
          connection_status: payload.connection_status,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robots"] });
    },
  });
}

export function useRenewCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RenewCertificatePayload) =>
      apiPost<Robot, { days: number }>(
        `/api/robots/${payload.id}/renew-certificate`,
        {
          days: payload.days,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robots"] });
    },
  });
}

export function useRobotApiKeys(robotId: string) {
  return useQuery({
    queryKey: ["robots", robotId, "api-keys"],
    queryFn: () => apiGet<RobotApiKey[]>(`/api/robots/${robotId}/api-keys`),
    refetchInterval: 5000,
  });
}

export function useCreateRobotApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRobotApiKeyPayload) =>
      apiPost<CreateRobotApiKeyResponse, { name: string; expires_in_days?: number }>(
        `/api/robots/${payload.robotId}/api-keys`,
        {
          name: payload.name,
          expires_in_days: payload.expires_in_days,
        }
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["robots", variables.robotId, "api-keys"],
      });
    },
  });
}

export function useRotateRobotApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RotateRobotApiKeyPayload) =>
      apiPost<RotateRobotApiKeyResponse, Record<string, never>>(
        `/api/robots/${payload.robotId}/api-keys/${payload.keyId}/rotate`,
        {}
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["robots", variables.robotId, "api-keys"],
      });
    },
  });
}

export function useRevokeRobotApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RevokeRobotApiKeyPayload) =>
      apiPost<RobotApiKey, Record<string, never>>(
        `/api/robots/${payload.robotId}/api-keys/${payload.keyId}/revoke`,
        {}
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["robots", variables.robotId, "api-keys"],
      });
    },
  });
}