import { getCurrentUser } from "@/server/auth/dal";
import { ROLE_LABELS } from "@/domain/roles";

export async function UserBadge() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <div aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
        {(user.firstName || "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 text-xs">
        <p className="truncate font-medium text-ink-1">{user.firstName || user.email}</p>
        <p className="truncate text-ink-3">{ROLE_LABELS[user.role]}{user.demo ? " · démo" : ""}</p>
      </div>
    </div>
  );
}

export function UserBadgeSkeleton() {
  return <div className="h-[52px] animate-pulse rounded-xl bg-surface-2" />;
}
