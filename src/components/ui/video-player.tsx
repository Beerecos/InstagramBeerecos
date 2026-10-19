export function VideoPlayer({ src, poster, title, captionsSrc }: { src: string; poster?: string; title: string; captionsSrc?: string }) {
  return (
    <figure className="mx-auto w-full max-w-xs">
      <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-black ring-1 ring-line">
        <video className="size-full object-contain" src={src} poster={poster} controls playsInline preload="metadata" aria-label={title}>
          {captionsSrc ? <track kind="captions" src={captionsSrc} srcLang="fr" label="Français" default /> : null}
        </video>
      </div>
      <figcaption className="mt-2 text-center text-sm text-ink-2">{title}</figcaption>
    </figure>
  );
}
