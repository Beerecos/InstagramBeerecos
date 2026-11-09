// Client des routes Canva du Studio (/api/canva/*). Les jetons Canva restent sur le serveur.
export type CanvaView = { appConfigured: boolean; connected: boolean; name: string | null; autofill: boolean | null; brandTemplates: boolean | null };
export type CanvaTemplate = { id: string; title: string; thumbnailUrl: string | null; editUrl: string | null };
export type CanvaField = { name: string; type: "text" | "image" | "chart" | "sheet" };
export type CanvaVisual = { paths: string[]; previews: Record<string, string>; editUrl: string | null; designId: string; pages: number; missing: string[] };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/canva${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur Canva (${res.status})`);
  return data as T;
}

export const canvaApi = {
  connection: () => call<CanvaView>("/connection"),
  disconnect: () => call<CanvaView>("/connection", { method: "DELETE" }),
  templates: (q = "") => call<{ templates: CanvaTemplate[] }>(`/templates${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  fields: (id: string) => call<{ fields: CanvaField[] }>(`/templates/${encodeURIComponent(id)}`),
  createVisual: (input: { templateId: string; title: string; texts: Record<string, string> }) => call<CanvaVisual>("/visuals", { method: "POST", body: JSON.stringify(input) }),
};
