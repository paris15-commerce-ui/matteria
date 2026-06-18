'use client';

import type { RefObject } from 'react';

/** Iframe Showcase Matterport — pilotée par useMatterport (SDK connecté au montage). */
export function MatterportViewer({
  iframeRef,
  src,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  src: string;
}) {
  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Visite virtuelle 3D"
      className="absolute inset-0 h-full w-full border-0"
      allow="xr-spatial-tracking; fullscreen; autoplay"
      allowFullScreen
    />
  );
}
