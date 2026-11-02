import { describe, expect, it } from "vitest";
import { EditSync, History, type SyncState } from "@/domain/studio/edit-sync";

function harness(opts: { fail?: (n: number) => string | null } = {}) {
  const calls: string[] = [];
  const states: SyncState[] = [];
  const fresh: string[] = [];
  let version = 1, n = 0;
  let release: (() => void) | null = null;
  const gate = () => new Promise<void>((r) => { release = r; });
  let gated = false;
  const sync = new EditSync<string, string, string>({
    saveEdit: async (edit, base) => {
      calls.push(`edit:${edit}@${base}`);
      if (gated) await gate();
      const err = opts.fail?.(++n);
      if (err) throw new Error(err);
      version++;
    },
    fixWords: async (fixes) => { calls.push(`fix:${fixes.join(",")}`); version++; },
    fetch: async () => ({ data: `serveur-v${version}`, updatedAt: `v${version}` }),
    onFresh: (d) => fresh.push(d),
    onState: (s) => states.push(s),
  }, "v1");
  const idle = async () => { for (let i = 0; i < 50 && sync.busy; i++) await new Promise((r) => setTimeout(r, 1)); };
  return { sync, calls, states, fresh, idle, hold: () => { gated = true; }, open: () => { gated = false; release?.(); } };
}

describe("montage instantané : enregistrement en arrière-plan", () => {
  it("regroupe les montages successifs pendant un envoi et n'envoie que le dernier état", async () => {
    const h = harness();
    h.hold();
    h.sync.pushEdit("A");
    h.sync.pushEdit("B");
    h.sync.pushEdit("C");
    await new Promise((r) => setTimeout(r, 1));
    h.open();
    await h.idle();
    expect(h.calls).toEqual(["edit:A@v1", "edit:C@v2"]);
    expect(h.fresh).toEqual(["serveur-v3"]); // version fraîche appliquée seulement une fois la file vide
    expect(h.states.at(-1)).toEqual({ status: "enregistré", pending: 0 });
  });

  it("garde l'ordre des corrections de mots et des montages", async () => {
    const h = harness();
    h.hold();
    h.sync.pushEdit("A");
    h.sync.pushFix(["mot 3"]);
    h.sync.pushEdit("B");
    await new Promise((r) => setTimeout(r, 1));
    h.open();
    await h.idle();
    expect(h.calls).toEqual(["edit:A@v1", "fix:mot 3", "edit:B@v3"]);
  });

  it("signale un conflit sans écraser la version faite ailleurs, et s'arrête", async () => {
    const h = harness({ fail: () => "Le montage a changé depuis l'ouverture : rechargez." });
    h.sync.pushEdit("A");
    await h.idle();
    h.sync.pushEdit("B");
    await h.idle();
    expect(h.states.at(-1)?.status).toBe("conflit");
    expect(h.calls).toEqual(["edit:A@v1"]);
    expect(h.fresh).toEqual([]);
  });

  it("une erreur réseau se réessaie sans perdre la modification", async () => {
    let first = true;
    const h = harness({ fail: () => (first ? ((first = false), "Erreur serveur (503)") : null) });
    h.sync.pushEdit("A");
    await h.idle();
    expect(h.states.at(-1)?.status).toBe("erreur");
    h.sync.retry();
    await h.idle();
    expect(h.calls).toEqual(["edit:A@v1", "edit:A@v1"]);
    expect(h.states.at(-1)?.status).toBe("enregistré");
  });
});

describe("historique local", () => {
  it("annule et refait instantanément, une nouvelle modification efface le refaire", () => {
    const h = new History<string>(3);
    h.record("v0"); h.record("v1");
    expect(h.undo("v2")).toBe("v1");
    expect(h.redo("v1")).toBe("v2");
    expect(h.undo("v2")).toBe("v1");
    h.record("v1");
    expect(h.canRedo).toBe(false);
    for (const v of ["a", "b", "c", "d"]) h.record(v);
    let k = 0; while (h.undo("x") !== undefined) k++;
    expect(k).toBe(3);
  });
});
