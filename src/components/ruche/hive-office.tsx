"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HiveAgent } from "@/server/missions/queries";
import { BUBBLE_SITTING_OFFSET_PX, BUBBLE_VERTICAL_OFFSET_PX, TILE_SIZE } from "@/vendor/pixel-agents/constants";
import { startGameLoop } from "@/vendor/pixel-agents/office/engine/gameLoop";
import { OfficeState } from "@/vendor/pixel-agents/office/engine/officeState";
import { renderFrame } from "@/vendor/pixel-agents/office/engine/renderer";
import { getCachedSprite } from "@/vendor/pixel-agents/office/sprites/spriteCache";
import { BUBBLE_PERMISSION_SPRITE } from "@/vendor/pixel-agents/office/sprites/spriteData";
import { CharacterState, TileType, type OfficeLayout } from "@/vendor/pixel-agents/office/types";
import { loadHiveAssets } from "./hive-assets";

/** Outil simulé côté animation uniquement : il choisit le geste (taper ou lire), jamais l'état. */
const GESTURE: Partial<Record<HiveAgent["key"], string>> = { researcher: "WebSearch", brand_guardian: "Read", analytics_agent: "Read", watchdog: "Read" };

const STATE_LABEL: Record<HiveAgent["state"], string> = {
  working: "Travaille",
  waiting_validation: "Attend votre validation",
  blocked: "En attente",
  idle: "Disponible",
};

/** Zone utile du plan (sans les cases vides) pour cadrer le bureau. */
function bounds(layout: OfficeLayout) {
  let c0 = layout.cols, c1 = 0, r0 = layout.rows, r1 = 0;
  layout.tiles.forEach((t, i) => {
    if (t === TileType.VOID) return;
    const c = i % layout.cols, r = Math.floor(i / layout.cols);
    c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r);
  });
  return { c0, c1, r0, r1 };
}

export function HiveOffice({ agents }: { agents: HiveAgent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const officeRef = useRef<OfficeState | null>(null);
  const viewRef = useRef({ zoom: 2, panX: 0, panY: 0, offsetX: 0, offsetY: 0 });
  const agentsRef = useRef(agents);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HiveAgent["key"] | null>(null);

  // Chargement des sprites et boucle de rendu.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    const canvas = canvasRef.current!;
    loadHiveAssets()
      .then((layout) => {
        if (cancelled) return;
        const office = new OfficeState(layout);
        agentsRef.current.forEach((_, i) => office.addAgent(i + 1, i % 6, i >= 6 ? 60 + i * 25 : 0, undefined, true));
        officeRef.current = office;
        const box = bounds(layout);
        const resize = () => {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          canvas.width = Math.round(rect.width * dpr);
          canvas.height = Math.round(rect.height * dpr);
          const w = (box.c1 - box.c0 + 1) * TILE_SIZE, h = (box.r1 - box.r0 + 1) * TILE_SIZE;
          const fit = Math.min(canvas.width / w, canvas.height / h);
          const zoom = fit >= 2 ? Math.floor(fit) : Math.max(0.5, fit);
          viewRef.current.zoom = zoom;
          viewRef.current.panX = (layout.cols / 2 - (box.c0 + box.c1 + 1) / 2) * TILE_SIZE * zoom;
          viewRef.current.panY = (layout.rows / 2 - (box.r0 + box.r1 + 1) / 2) * TILE_SIZE * zoom;
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        const loopStop = startGameLoop(canvas, {
          update: (dt) => office.update(dt),
          render: (ctx) => {
            const v = viewRef.current;
            const l = office.getLayout();
            const { offsetX, offsetY } = renderFrame(ctx, canvas.width, canvas.height, office.tileMap, office.furniture, office.getCharacters(), v.zoom, v.panX, v.panY, undefined, undefined, l.tileColors, l.cols, l.rows, l.carpetTiles, l.areas, l.areaTiles, false, null, office.pets);
            v.offsetX = offsetX;
            v.offsetY = offsetY;
            // Étiquettes : prénom de l'agent au-dessus du personnage.
            ctx.font = `600 ${Math.max(9, Math.round(3.6 * v.zoom))}px Poppins, sans-serif`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            for (const ch of office.getCharacters()) {
              const a = agentsRef.current[ch.id - 1];
              if (!a) continue;
              const sit = ch.state === CharacterState.TYPE ? BUBBLE_SITTING_OFFSET_PX : 0;
              const bx = offsetX + ch.x * v.zoom, by = offsetY + (ch.y - BUBBLE_VERTICAL_OFFSET_PX + sit) * v.zoom;
              if (a.state === "waiting_validation") {
                // Bulle « … » : un contenu attend votre validation.
                const bubble = getCachedSprite(BUBBLE_PERMISSION_SPRITE, v.zoom);
                ctx.drawImage(bubble, Math.round(bx - bubble.width / 2), Math.round(by - bubble.height));
              } else if (a.state === "blocked") {
                // Bulle « ! » : connexion manquante, erreur ou alerte du Watchdog.
                const r = 5 * v.zoom;
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(Math.round(bx - r), Math.round(by - 2 * r), Math.round(2 * r), Math.round(2 * r));
                ctx.fillStyle = "#D93025";
                ctx.font = `700 ${Math.round(1.6 * r)}px Poppins, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("!", bx, by - r);
              }
              ctx.font = `600 ${Math.max(9, Math.round(3.6 * v.zoom))}px Poppins, sans-serif`;
              const x = offsetX + ch.x * v.zoom, y = offsetY + (ch.y + 5) * v.zoom;
              const text = a.name;
              const tw = ctx.measureText(text).width + 3 * v.zoom;
              ctx.fillStyle = a.key === "queen_bee" ? "#2851FF" : a.key === "watchdog" ? "#000000" : "rgba(255,255,255,0.92)";
              ctx.fillRect(Math.round(x - tw / 2), Math.round(y - 3 * v.zoom), Math.round(tw), Math.round(6 * v.zoom));
              ctx.fillStyle = a.key === "queen_bee" || a.key === "watchdog" ? "#FFFFFF" : "#000000";
              ctx.fillText(text, x, y);
            }
          },
        });
        stop = () => {
          loopStop();
          observer.disconnect();
        };
        setReady(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Synchronisation : l'état réel des tâches pilote l'animation.
  useEffect(() => {
    const office = officeRef.current;
    agentsRef.current = agents;
    if (!ready || !office) return;
    agents.forEach((a, i) => {
      const id = i + 1;
      const working = a.state === "working";
      office.setAgentActive(id, working);
      office.setAgentTool(id, working ? GESTURE[a.key] ?? "Write" : null);
    });
  }, [agents, ready]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const office = officeRef.current;
    if (!office) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const v = viewRef.current;
    const wx = ((e.clientX - rect.left) * dpr - v.offsetX) / v.zoom;
    const wy = ((e.clientY - rect.top) * dpr - v.offsetY) / v.zoom;
    const id = office.getCharacterAt(wx, wy);
    setSelected(id ? agentsRef.current[id - 1]?.key ?? null : null);
  };

  const current = agents.find((a) => a.key === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-card bg-[#1c1d2b] ring-1 ring-line">
        <canvas ref={canvasRef} onClick={onClick} className="block aspect-[7/4] max-h-[600px] w-full cursor-pointer" style={{ imageRendering: "pixelated" }} aria-label="Bureau de l'équipe IA en pixel art : chaque personnage est un agent BeeMarketing" role="img" />
        {!ready && !error ? <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Ouverture de la Ruche…</p> : null}
        {error ? <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">{error}</p> : null}
      </div>

      {current ? (
        <div className="rounded-2xl bg-surface-1 p-4 ring-1 ring-brand/40" aria-live="polite">
          <p className="font-semibold text-ink-1">{current.name} <span className="font-normal text-ink-3">— {current.role}</span></p>
          <p className="text-sm text-ink-2">{STATE_LABEL[current.state]}{current.detail ? ` · ${current.detail}` : ""}{current.isDemo ? " · Démo" : ""}</p>
          {current.missionId ? <Link href={`/missions/${current.missionId}`} className="mt-1 inline-block text-sm font-medium text-brand">Voir la mission →</Link> : null}
        </div>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="État des agents">
        {agents.map((a) => (
          <li key={a.key}>
            <button type="button" onClick={() => setSelected(a.key)} className={`flex w-full items-center gap-3 rounded-xl bg-surface-1 px-3 py-2 text-left ring-1 transition hover:ring-brand ${selected === a.key ? "ring-brand" : "ring-line"}`}>
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${a.state === "working" ? "bg-brand" : a.state === "waiting_validation" ? "bg-status-warning" : a.state === "blocked" ? "bg-status-critical" : "bg-line"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-1">{a.name}</span>
                <span className="block truncate text-xs text-ink-3">{STATE_LABEL[a.state]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
