import React from "react";
import { Composition } from "remotion";
import { CFG, FormatKey } from "./config";
import { Master } from "./Master";

/** Deux déclinaisons du même montage maître : 9:16 (principal) et 16:9. */
export const RemotionRoot: React.FC = () => (
  <>
    {(Object.keys(CFG.formats) as FormatKey[]).map((k) => {
      const f = CFG.formats[k];
      return (
        <Composition
          key={k}
          id={`BeeMarketing-${f.id}`}
          component={Master}
          durationInFrames={CFG.video.durationInFrames}
          fps={CFG.video.fps}
          width={f.width}
          height={f.height}
          defaultProps={{ format: k, captions: true }}
        />
      );
    })}
  </>
);
