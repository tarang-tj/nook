import type { Turn } from "./geometry";
import { furnitureShapes } from "./furniture";
import type { PieceId } from "./pieces";
import { thumbProject } from "./view";

export function SpinIcon({ dir }: { dir: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={
          dir === 1
            ? "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
            : "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={dir === 1 ? "M21 3v5h-5" : "M3 3v5h5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Thumbnail of one piece. The view box hugs the drawing so small pieces stay readable. */
export function MiniArt({ id, turn }: { id: PieceId; turn: Turn }) {
  const shapes = furnitureShapes(id, 0.5, 0.5, turn, thumbProject);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of shapes) {
    for (const pair of shape.points.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      xs.push(x);
      ys.push(y);
    }
  }
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max((Math.max(...xs) - Math.min(...xs)) * 1.1, ((Math.max(...ys) - Math.min(...ys)) * 1.1 * 72) / 64, 40);
  const h = (w * 64) / 72;
  return (
    <svg className="glyph" viewBox={`${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`} aria-hidden="true">
      {shapes.map((shape, index) => (
        <polygon key={index} points={shape.points} fill={shape.fill} />
      ))}
    </svg>
  );
}
