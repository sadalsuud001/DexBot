import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "../../lib/api";
import type {
  CreateRobotPayload,
  RenewCertificatePayload,
  Robot,
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