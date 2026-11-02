export const ROLES = ["admin", "content_manager", "club_manager", "sales", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  content_manager: "Responsable contenu",
  club_manager: "Responsable de club",
  sales: "Commercial",
  viewer: "Lecteur",
};

/** Capacités applicatives. Les mêmes règles sont appliquées en base par la RLS. */
export type Permission =
  | "settings:manage"
  | "autopilot:manage"
  | "integrations:manage"
  | "content:edit"
  | "content:approve"
  | "publication:schedule"
  | "leads:read"
  | "leads:edit"
  | "clubs:manage"
  | "audit:read";

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: [
    "settings:manage",
    "autopilot:manage",
    "integrations:manage",
    "content:edit",
    "content:approve",
    "publication:schedule",
    "leads:read",
    "leads:edit",
    "clubs:manage",
    "audit:read",
  ],
  content_manager: ["content:edit", "content:approve", "publication:schedule"],
  club_manager: ["leads:read", "leads:edit"],
  sales: ["leads:read", "leads:edit"],
  viewer: [],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

/**
 * Base partagée avec BeeMarketing (2026-11-02) : les rôles viennent de `user_roles.role_key`.
 * Un seul utilisateur prévu (Cédric) : la direction est administratrice, tout autre rôle reste lecteur.
 */
export const BEEMARKETING_ADMIN_ROLES = ["SUPER_ADMIN", "DIRECTION"] as const;

export function roleFromBeeMarketing(roleKeys: readonly string[]): Role {
  return roleKeys.some((k) => (BEEMARKETING_ADMIN_ROLES as readonly string[]).includes(k)) ? "admin" : "viewer";
}
