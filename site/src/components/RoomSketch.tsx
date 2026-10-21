/*
 * The landing-page room sketch: pick an example room, drag pieces onto the floor,
 * turn them, and see whether they fit and, if not, why.
 *
 * Hooks for a recording script (keep these stable):
 * - Room switcher: role="group" aria-label="Example rooms"; buttons
 *   [data-testid="room-option-<roomId>"] with aria-pressed. Room ids: dorm-single, studio, shared.
 * - Palette: [data-testid="piece-<pieceId>"], aria-label "<Name>. Drag it into the room."
 *   A tap without a drag places the piece at the nearest spot that fits.
 *   Piece ids: bed, desk, fridge, loveseat, dresser, bookshelf, nightstand.
 * - Drop area: svg [data-testid="room-drop"] with data-room="<roomId>"; the floor
 *   polygon inside it is [data-testid="room-floor"].
 * - Placed pieces: [data-testid="placed-<pieceId>"] (focusable; arrows move, R turns).
 * - Turn buttons: [data-testid="turn-left"], [data-testid="turn-right"].
 * - Verdict line: [data-testid="fit-verdict"] with data-tone="idle" | "fit" | "miss".
 */
import { motion, useReducedMotion } from "motion/react";
import { MiniArt, SpinIcon } from "./room/Art";
import { featureArt } from "./room/feature-shapes";
import { furnitureShapes } from "./room/furniture";
import type { Shape } from "./room/geometry";
import { dims, PIECES, pieceById, type Placed } from "./room/pieces";
import { ROOMS } from "./room/rooms";
import { usePlacement } from "./room/use-placement";
import { VIEW, type View } from "./room/view";

function polys(shapes: Shape[], withBody = true) {
  return shapes.map((shape, index) => (
    <polygon key={index} points={shape.points} fill={shape.fill} className={withBody && shape.body ? "body" : undefined} />
  ));
}

export function RoomSketch() {
  const reduce = useReducedMotion() ?? false;
  const s = usePlacement();
  const { room, view, placed, drag, selected } = s;
  const project = view.project;
  const dragId = drag?.id ?? null;
  const active = placed.find((item) => item.id === selected) ?? null;

  const corner = (u: number, v: number, lift = 0) => {
    const p = project(u, v, lift / view.scale);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  };
  const floor = [corner(0, 0), corner(room.u, 0), corner(room.u, room.v), corner(0, room.v)].join(" ");
  const leftWall = [corner(0, 0), corner(0, room.v), corner(0, room.v, view.wall), corner(0, 0, view.wall)].join(" ");
  const backWall = [corner(0, 0), corner(room.u, 0), corner(room.u, 0, view.wall), corner(0, 0, view.wall)].join(" ");
  const arts = room.features.map((feature) => ({ feature, art: featureArt(feature, project) }));
  const solids = [
    ...arts.map(({ feature, art }) => ({ key: art.key, id: feature.id, art, item: null as Placed | null })),
    ...placed.map((item) => ({ key: item.u + item.v, id: item.id as string, art: null, item })),
  ].sort((a, b) => a.key - b.key);
  const hint = project(room.u / 2, room.v * 0.55);

  return (
    <div className="sketch" id="sketch">
      <div className="rooms" role="group" aria-label="Example rooms">
        {ROOMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === room.id ? "room-option is-on" : "room-option"}
            aria-pressed={item.id === room.id}
            aria-label={`Example room: ${item.name}`}
            data-testid={`room-option-${item.id}`}
            onClick={() => s.switchRoom(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="play">
        <ul className="catalog" aria-label="Furniture">
          {PIECES.map((piece) => {
            const inRoom = placed.some((item) => item.id === piece.id);
            return (
              <li key={piece.id}>
                <button
                  type="button"
                  className={inRoom ? "catalog-item is-placed" : "catalog-item"}
                  aria-pressed={inRoom}
                  aria-label={`${piece.name}. Drag it into the room.`}
                  data-testid={`piece-${piece.id}`}
                  onPointerDown={(event) => s.startDrag(piece.id, false, event)}
                  onPointerUp={s.finishDrag}
                  onPointerCancel={s.cancelDrag}
                  onClick={(event) => {
                    // detail is 0 only for keyboard presses; pointer taps are handled in finishDrag.
                    if (event.detail === 0) s.placeByKey(piece.id);
                  }}
                >
                  <MiniArt id={piece.id} turn={0} />
                  <span>{piece.name}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="scene-wrap">
          <motion.div
            className="scene"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <svg
              ref={s.svgRef}
              className="room-svg"
              viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
              role="group"
              aria-label={`Example room: ${room.name}`}
              data-testid="room-drop"
              data-room={room.id}
            >
              <polygon className="wall wall-left" points={leftWall} />
              <polygon className="wall wall-back" points={backWall} />
              <polygon className={s.dragOk ? "floor is-hot" : "floor"} points={floor} data-testid="room-floor" />
              <g className="floor-grid" aria-hidden="true">
                {[0.25, 0.5, 0.75].map((mark) => (
                  <g key={mark}>
                    <line x1={project(mark * room.u, 0).x} y1={project(mark * room.u, 0).y} x2={project(mark * room.u, room.v).x} y2={project(mark * room.u, room.v).y} />
                    <line x1={project(0, mark * room.v).x} y1={project(0, mark * room.v).y} x2={project(room.u, mark * room.v).x} y2={project(room.u, mark * room.v).y} />
                  </g>
                ))}
              </g>
              {arts.map(({ feature, art }) => (
                <g key={feature.id} className={`fixture-flat${s.hitId === feature.id ? " is-hit" : ""}`} aria-hidden="true">
                  {polys(art.flat, false)}
                </g>
              ))}
              {placed.length === 0 && !drag && (
                <text className="floor-hint" x={hint.x} y={hint.y}>
                  Drop pieces here
                </text>
              )}
              {solids.map(({ id, art, item }) =>
                art ? (
                  <g key={id} className={`fixture${s.hitId === id ? " is-hit" : ""}`} aria-hidden="true">
                    {polys(art.solid, false)}
                  </g>
                ) : item ? (
                  <PlacedPiece key={item.id} item={item} view={view} s={s} dragging={dragId === item.id} />
                ) : null,
              )}
            </svg>
            {active && dragId !== active.id && (
              <div className="spin" style={arrowAnchor(active, view)}>
                <button type="button" data-testid="turn-left" aria-label={`Turn ${pieceById(active.id).name} left`} onClick={() => s.rotate(active.id, -1)}>
                  <SpinIcon dir={-1} />
                </button>
                <button type="button" data-testid="turn-right" aria-label={`Turn ${pieceById(active.id).name} right`} onClick={() => s.rotate(active.id, 1)}>
                  <SpinIcon dir={1} />
                </button>
              </div>
            )}
          </motion.div>
          <p className={`verdict is-${s.tone}`} role="status" data-testid="fit-verdict" data-tone={s.tone}>
            {s.verdict}
          </p>
        </div>
      </div>
      <p className="sketch-note">
        Pick a room, then drag the pieces onto the floor. Use the arrows to turn the selected one.
        Drag a piece out of the room to remove it. These are example rooms, not a measurement of yours.
      </p>
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <MiniArt id={drag.id} turn={drag.turn} />
        </div>
      )}
    </div>
  );
}

type PieceProps = { item: Placed; view: View; s: ReturnType<typeof usePlacement>; dragging: boolean };

function PlacedPiece({ item, view, s, dragging }: PieceProps) {
  return (
    <g
      className={`furn${item.id === s.selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}${s.hitId === item.id ? " is-hit" : ""}`}
      data-turn={item.turn}
      data-testid={`placed-${item.id}`}
      tabIndex={0}
      role="button"
      aria-label={`${pieceById(item.id).name}. Drag to move it. Use the arrows to turn it. Drag it out of the room to remove it.`}
      onPointerDown={(event) => s.startDrag(item.id, true, event)}
      onPointerUp={s.finishDrag}
      onPointerCancel={s.cancelDrag}
      onDoubleClick={() => s.rotate(item.id)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.08 : 0.04;
        if (event.key === "ArrowLeft") s.nudge(item.id, -step, 0);
        else if (event.key === "ArrowRight") s.nudge(item.id, step, 0);
        else if (event.key === "ArrowUp") s.nudge(item.id, 0, -step);
        else if (event.key === "ArrowDown") s.nudge(item.id, 0, step);
        else if (event.key === "r" || event.key === "R") s.rotate(item.id);
        else return;
        event.preventDefault();
      }}
    >
      {polys(furnitureShapes(item.id, item.u, item.v, item.turn, view.project))}
    </g>
  );
}

function arrowAnchor(item: Placed, view: View): { left: string; top: string } {
  const { wu, hv } = dims(item.id, item.turn);
  const point = view.project(item.u + wu / 2 + 0.04, item.v - hv / 2, 6);
  const left = Math.min(90, Math.max(10, ((point.x - VIEW.x) / VIEW.w) * 100));
  const top = Math.min(86, Math.max(12, ((point.y - VIEW.y) / VIEW.h) * 100));
  return { left: `${left}%`, top: `${top}%` };
}
