"use client";
import { BRAND_NAME, COLORS, FONT_FAMILY, LOGOS } from "@/domain/social/reel-story/brand";

/** Reflects the same official assets/constants used by the renderer. */
export default function ReelBrandCharter() {
  return <details className="card p-4">
    <summary className="cursor-pointer font-semibold">Charte {BRAND_NAME} · utilisée pour ce Reel</summary>
    <div className="mt-3 flex flex-wrap items-center gap-5 text-sm">
      <img src={`/hyperframes/${LOGOS.endHorizontal.file}`} alt={`Logo officiel ${BRAND_NAME}`} width={180} height={40} className="h-auto w-[180px]" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">{(["blue", "black", "white"] as const).map(color => <span key={color} className="flex items-center gap-1.5 text-xs">
          <span className="h-5 w-5 rounded-full border border-line" style={{ backgroundColor: COLORS[color] }} aria-hidden />{COLORS[color]}
        </span>)}</div>
        <p>{FONT_FAMILY} · logo et signature officiels · #MonReseauCestTonReseau</p>
        <p className="text-xs text-mut">À l’écran : {BRAND_NAME}. À l’oral : « Bireuco ».</p>
      </div>
    </div>
  </details>;
}
