/** Durée lue par le navigateur (métadonnées seules). */
export function videoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(v.duration)) resolve(Math.round(v.duration * 1000));
      else reject(new Error("Durée illisible."));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Ce navigateur ne sait pas lire cette vidéo : exportez-la en .mp4 (H.264)."));
    };
    v.src = url;
  });
}
