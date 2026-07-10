'use client';
import { useState } from 'react';

/**
 * Shows /public/<file> as an image. If the file isn't there yet, it falls back
 * to the "add image" placeholder — so the page looks intentional whether or not
 * the screenshots have been added.
 */
export default function ShotImage({ file }: { file: string }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return <div className="ph">add image — {file}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/${file}`}
      alt={file}
      className="shotimg"
      onError={() => setMissing(true)}
    />
  );
}