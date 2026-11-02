/**
 * Montage instantané (Instagram BeeRecos) : la modification s'applique tout de suite à l'écran, l'enregistrement suit
 * en arrière-plan. File sérialisée (jamais deux écritures en même temps sur un montage) :
 * - les montages successifs sont regroupés : seul le dernier état est envoyé (l'historique local garde les autres) ;
 * - les corrections de mots partent dans l'ordre, sans regroupement ;
 * - chaque écriture porte la version serveur connue (`baseUpdatedAt`) : une modification faite ailleurs est un
 *   conflit signalé, jamais écrasée ;
 * - la version fraîche du serveur n'est appliquée que lorsque la file est vide (aucune frappe locale perdue).
 */
export type SyncState = { status: "enregistré" | "enregistrement" | "erreur" | "conflit"; error?: string; pending: number };

export type SyncDeps<E, F, D> = {
  saveEdit: (edit: E, baseUpdatedAt: string) => Promise<unknown>;
  fixWords: (fixes: F[]) => Promise<unknown>;
  fetch: () => Promise<{ data: D; updatedAt: string }>;
  onFresh: (data: D) => void;
  onState: (state: SyncState) => void;
};

type Task<E, F> = { kind: "edit"; edit: E } | { kind: "fix"; fixes: F[] };

export const isConflict = (message: string) => /a changé|modifié ailleurs|conflit|409/i.test(message);

export class EditSync<E, F, D> {
  private queue: Task<E, F>[] = [];
  private running = false;
  private state: SyncState = { status: "enregistré", pending: 0 };
  constructor(private deps: SyncDeps<E, F, D>, private version: string) {}

  get baseVersion() { return this.version; }
  get busy() { return this.running || this.queue.length > 0; }

  /** Nouvel état du montage : remplace un montage encore en attente (regroupement). */
  pushEdit(edit: E) {
    // Le dernier montage en attente (pas celui en cours d'envoi) est remplacé ; l'ordre avec les corrections est gardé.
    const last = this.queue.length - 1;
    if (last >= 0 && this.queue[last].kind === "edit" && !(this.running && last === 0)) this.queue[last] = { kind: "edit", edit };
    else this.queue.push({ kind: "edit", edit });
    this.kick();
  }
  pushFix(fixes: F[]) { this.queue.push({ kind: "fix", fixes }); this.kick(); }

  /** Après une version reçue par ailleurs (rechargement complet) : nouvelle base, file vidée. */
  reset(version: string) { this.queue = []; this.version = version; this.emit({ status: "enregistré" }); }
  retry() { if (this.state.status === "erreur") this.kick(); }

  private emit(s: Omit<SyncState, "pending">) { this.state = { ...s, pending: this.queue.length }; this.deps.onState(this.state); }

  private kick() {
    if (this.state.status === "conflit") { this.emit({ status: "conflit", error: this.state.error }); return; }
    if (this.running) { this.emit({ status: "enregistrement" }); return; }
    void this.loop();
  }

  private async loop() {
    this.running = true;
    try {
      while (this.queue.length) {
        this.emit({ status: "enregistrement" });
        const task = this.queue[0];
        try {
          if (task.kind === "edit") await this.deps.saveEdit(task.edit, this.version);
          else await this.deps.fixWords(task.fixes);
          this.queue.shift();
          const fresh = await this.deps.fetch();
          this.version = fresh.updatedAt;
          if (!this.queue.length) this.deps.onFresh(fresh.data);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Enregistrement impossible.";
          this.emit({ status: isConflict(message) ? "conflit" : "erreur", error: message });
          return;
        }
      }
      this.emit({ status: "enregistré" });
    } finally { this.running = false; }
  }
}

/** Historique local annuler / refaire (30 états), pour des retours en arrière instantanés. */
export class History<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  constructor(private max = 30) {}
  record(before: T) { this.undoStack = [...this.undoStack, before].slice(-this.max); this.redoStack = []; }
  undo(current: T): T | undefined { const prev = this.undoStack.pop(); if (prev !== undefined) this.redoStack.push(current); return prev; }
  redo(current: T): T | undefined { const next = this.redoStack.pop(); if (next !== undefined) this.undoStack.push(current); return next; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  clear() { this.undoStack = []; this.redoStack = []; }
}
