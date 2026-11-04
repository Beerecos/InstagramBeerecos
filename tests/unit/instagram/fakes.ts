import type { Connection, Row, Store } from "@/server/instagram/service";

const SB = "https://wekbmkjvieagmghjanjb.supabase.co";

/** Faux stockage des publications (tests sans base). */
export function memoryStore(conn: Connection | null = { igUserId: "1784", username: "beerecos", accessToken: "TOKEN", expiresAt: null }) {
  const rows = new Map<string, Row>();
  const rules: unknown[] = [];
  let n = 0;
  const store: Store & { rows: typeof rows; rules: unknown[]; conn: Connection | null } = {
    rows, rules, conn,
    async getConnection() { return store.conn; },
    async saveConnection(c) { store.conn = c; },
    async deleteConnection() { store.conn = null; },
    async list() { return [...rows.values()]; },
    async get(u, id) { const r = rows.get(id); return r && r.createdBy === u ? r : null; },
    async insert(u, d) {
      const id = `p${++n}`;
      const r: Row = { id, createdBy: u, kind: d.kind, montageId: d.montageId ?? null, title: d.title, caption: d.caption, media: d.media, keyword: d.keyword ?? null, dmText: d.dmText ?? null, buttonTitle: d.buttonTitle ?? null, buttonUrl: d.buttonUrl ?? null, status: "draft", containerId: null, igMediaId: null, permalink: null, publishedAt: null, error: null, updatedAt: "t", linkedinText: null, linkedinTarget: "profil", linkedinStatus: "none", linkedinUrl: null, linkedinPublishedAt: null, linkedinError: null };
      rows.set(id, r); return r;
    },
    async update(u, id, d) { const r = await store.get(u, id); if (!r || !["draft", "error"].includes(r.status)) return null; const next = { ...r, ...d, keyword: d.keyword ?? null, dmText: d.dmText ?? null } as Row; rows.set(id, next); return next; },
    async remove(u, id) { return rows.delete(id); },
    async transition(id, from, patch, when) {
      const r = rows.get(id);
      if (!r || !from.includes(r.status) || (when && r.containerId !== when)) return null;
      const next = { ...r, ...patch } as Row; rows.set(id, next); return next;
    },
    async addDmRule(rule) { rules.push(rule); },
    async transitionLinkedIn(id, from, patch) {
      const r = rows.get(id);
      if (!r || !from.includes(r.linkedinStatus)) return null;
      const { linkedinPostUrn, ...rest } = patch;
      const next = { ...r, ...rest, ...(linkedinPostUrn ? { linkedinUrl: `https://www.linkedin.com/feed/update/${linkedinPostUrn}/` } : {}) } as Row; rows.set(id, next); return next;
    },
    async signMedia(media) { return media.map((m) => `${SB}/storage/v1/object/sign/ig-media/${m.path}?token=x`); },
  };
  return store;
}

