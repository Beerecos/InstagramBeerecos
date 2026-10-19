import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import { MISSION_STATUS_LABELS, TASK_STATUS_LABELS, type MissionStatus, type TaskStatus } from "@/domain/missions/types";

const TASK_TONE: Record<TaskStatus, Tone> = {
  todo: "neutral",
  analysis: "progress",
  in_progress: "progress",
  waiting: "warning",
  to_validate: "warning",
  validated: "good",
  scheduled: "brand",
  published: "good",
  done: "good",
  error: "critical",
};

const MISSION_TONE: Record<MissionStatus, Tone> = {
  planned: "neutral",
  running: "progress",
  waiting_input: "warning",
  waiting_validation: "warning",
  done: "good",
  error: "critical",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge label={TASK_STATUS_LABELS[status]} tone={TASK_TONE[status]} />;
}

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return <StatusBadge label={MISSION_STATUS_LABELS[status]} tone={MISSION_TONE[status]} />;
}

export function DemoBadge() {
  return <span className="rounded-md bg-ink-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-1">Démo</span>;
}
