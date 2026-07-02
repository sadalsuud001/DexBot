import { AlertTriangle, Bot, CircleCheck, CircleX, WifiOff } from "lucide-react";
import {
  useCreateRobot,
  useRenewCertificate,
  useRobots,
  useUpdateRobotStatus,
} from "./api";
import type { Robot, RobotStatus } from "./types";
import { type ReactNode } from "react";
import { RobotApiKeysPanel } from "./RobotApiKeysPanel";

export function RobotsPage() {
  const { data: robots, isLoading, isError, error } = useRobots();
  const createRobot = useCreateRobot();
  const updateStatus = useUpdateRobotStatus();
  const renewCertificate = useRenewCertificate();

  const isMutating =
    createRobot.isPending ||
    updateStatus.isPending ||
    renewCertificate.isPending;

  if (isLoading) {
    return (
      <PageShell title="Robots">
        <div className="text-slate-400">Loading robots...</div>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell title="Robots">
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200">
          Failed to load robots: {error.message}
        </div>
      </PageShell>
    );
  }

  const total = robots?.length ?? 0;
  const online = robots?.filter((robot) => robot.connection_status === "online").length ?? 0;
  const offline = robots?.filter((robot) => robot.connection_status === "offline").length ?? 0;
  const errorCount = robots?.filter((robot) => robot.connection_status === "error").length ?? 0;

  return (
    <PageShell title="Robots">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Robots" value={total} />
        <MetricCard label="Online" value={online} />
        <MetricCard label="Offline" value={offline} />
        <MetricCard label="Error" value={errorCount} />
      </div>
      <CreateRobotQuickButton />

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {robots?.map((robot) => (
          <RobotCard
            key={robot.id}
            robot={robot}
            isMutating={isMutating}
            onStatusChange={(status) =>
              updateStatus.mutate({
                id: robot.id,
                connection_status: status,
              })
            }
            onRenewCertificate={() =>
              renewCertificate.mutate({
                id: robot.id,
                days: 365,
              })
            }
          />
        ))}
      </div>
    </PageShell>
  );
}

function PageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Register, monitor and control individual robots in the DexBot fleet.
        </p>
      </div>

      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function RobotCard({
  robot,
  isMutating,
  onStatusChange,
  onRenewCertificate,
}: {
  robot: Robot;
  isMutating: boolean;
  onStatusChange: (status: RobotStatus) => void;
  onRenewCertificate: () => void;
}) {
  const certStatus = getCertificateStatus(robot.certificate_expires_at);
  const capabilities = robot.config.capabilities ?? [];

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-800 p-2">
            <Bot className="h-5 w-5 text-slate-200" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">{robot.name}</h2>
            <div className="mt-1 text-sm text-slate-400">
              {robot.serial_number} · {robot.model}
            </div>
          </div>
        </div>

        <StatusBadge status={robot.connection_status} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <InfoItem label="Firmware" value={robot.firmware_version} />
        <InfoItem label="IP Address" value={formatIp(robot.ip_address)} />
        <InfoItem label="Location" value={robot.config.location ?? "Unknown"} />
        <InfoItem
          label="Max Payload"
          value={
            robot.config.max_payload_kg
              ? `${robot.config.max_payload_kg} kg`
              : "Unknown"
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">

      

      <ActionButton
        disabled={isMutating}
        onClick={() => onStatusChange("online")}
      >
        Set Online
      </ActionButton>

      <ActionButton
        disabled={isMutating}
        onClick={() => onStatusChange("offline")}
      >
        Set Offline
      </ActionButton>

      <ActionButton
        disabled={isMutating}
        onClick={() => onStatusChange("error")}
      >
        Set Error
      </ActionButton>

      <ActionButton
        disabled={isMutating}
        onClick={onRenewCertificate}
      >
        Renew Cert
      </ActionButton>
    </div>

    <RobotApiKeysPanel robotId={robot.id} />

      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-slate-300">
          Capabilities
        </div>

        <div className="flex flex-wrap gap-2">
          {capabilities.length > 0 ? (
            capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300"
              >
                {capability}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No capabilities</span>
          )}
        </div>
      </div>

      <div
        className={[
          "mt-5 rounded-lg border p-3 text-sm",
          certStatus.level === "danger"
            ? "border-red-800 bg-red-950/40 text-red-200"
            : certStatus.level === "warning"
              ? "border-amber-800 bg-amber-950/40 text-amber-200"
              : "border-slate-800 bg-slate-950 text-slate-300",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          {certStatus.level === "ok" ? (
            <CircleCheck className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <span>{certStatus.message}</span>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: RobotStatus }) {
  const config = {
    online: {
      label: "Online",
      className: "border-emerald-800 bg-emerald-950/50 text-emerald-300",
      icon: CircleCheck,
    },
    offline: {
      label: "Offline",
      className: "border-slate-700 bg-slate-950 text-slate-300",
      icon: WifiOff,
    },
    error: {
      label: "Error",
      className: "border-red-800 bg-red-950/50 text-red-300",
      icon: CircleX,
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.className,
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-200">{value}</div>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function formatIp(ip: string | null) {
  if (!ip) return "Unknown";
  return ip.replace("/32", "");
}

function getCertificateStatus(expiresAt: string): {
  level: "ok" | "warning" | "danger";
  message: string;
} {
  const expiration = new Date(expiresAt);
  const now = new Date();

  const daysRemaining = Math.ceil(
    (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining <= 14) {
    return {
      level: "danger",
      message: `Certificate expires in ${daysRemaining} days. Renewal required.`,
    };
  }

  if (daysRemaining <= 45) {
    return {
      level: "warning",
      message: `Certificate expires in ${daysRemaining} days. Schedule renewal soon.`,
    };
  }

  return {
    level: "ok",
    message: `Certificate valid for ${daysRemaining} days.`,
  };
}

function CreateRobotQuickButton() {
  const createRobot = useCreateRobot();

  function handleCreate() {
    const suffix = Math.floor(Math.random() * 10000);

    createRobot.mutate({
      serial_number: `DXB-${suffix}`,
      name: `DexBot Demo ${suffix}`,
      model: "DX-Industrial-A1",
      firmware_version: "1.0.0",
      ip_address: `10.0.1.${Math.floor(Math.random() * 200) + 30}`,
      connection_status: "offline",
      config: {
        capabilities: ["inspect", "carry"],
        location: "bay-1",
        max_payload_kg: 10,
      },
      certificate_valid_days: 365,
    });
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Register Robot</h2>
          <p className="mt-1 text-sm text-slate-400">
            Create a demo robot and persist it to PostgreSQL.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={createRobot.isPending}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createRobot.isPending ? "Creating..." : "Create Robot"}
        </button>
      </div>

      {createRobot.error instanceof Error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {createRobot.error.message}
        </div>
      )}
    </div>
  );
}