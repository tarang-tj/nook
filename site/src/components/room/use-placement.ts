import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { carryOver, checkFit, firstFit, missText, onFloor, type Miss } from "./fit";
import { stepTurn, type Spot, type Turn } from "./geometry";
import { pieceById, type Placed, type PieceId } from "./pieces";
import { ROOMS, roomById, type RoomId } from "./rooms";
import { makeView } from "./view";

type Drag = { id: PieceId; x: number; y: number; turn: Turn; fromRoom: boolean };
export type Tone = "idle" | "fit" | "miss";

/** Room, placements and drag state for the sketch, with the handlers that change them. */
export function usePlacement() {
  const svgRef = useRef<SVGSVGElement>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const [roomId, setRoomId] = useState<RoomId>(ROOMS[0].id);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [miss, setMiss] = useState<Miss | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const room = roomById(roomId);
  const view = makeView(room);
  const others = (id: PieceId) => placed.filter((item) => item.id !== id);

  function locate(clientX: number, clientY: number): Spot | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    const spot = view.toUV(local.x, local.y);
    const pad = 0.12;
    if (spot.u < -pad || spot.v < -pad || spot.u > room.u + pad || spot.v > room.v + pad) return null;
    return spot;
  }

  function say(next: Miss | null, text: string | null = null) {
    setMiss(next);
    setNotice(text);
  }

  function startDrag(id: PieceId, fromRoom: boolean, event: ReactPointerEvent<Element>) {
    event.preventDefault();
    stopDragRef.current?.();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture. The window listeners still follow the pointer.
    }
    startRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    const existing = placed.find((item) => item.id === id);
    const next = { id, x: event.clientX, y: event.clientY, turn: existing?.turn ?? 0, fromRoom };
    dragRef.current = next;
    setDrag(next);

    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      if (dx * dx + dy * dy > 36) movedRef.current = true;
      const updated = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      dragRef.current = updated;
      setDrag(updated);
    };
    const end = (ev: PointerEvent) => {
      stop();
      finishDrag(ev as unknown as ReactPointerEvent<Element>);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (stopDragRef.current === stop) stopDragRef.current = null;
    };
    stopDragRef.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function cancelDrag() {
    stopDragRef.current?.();
    dragRef.current = null;
    setDrag(null);
  }

  function finishDrag(event: ReactPointerEvent<Element>) {
    stopDragRef.current?.();
    const current = dragRef.current;
    const moved = movedRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;
    if (!moved) {
      if (!current.fromRoom && !placed.some((item) => item.id === current.id)) {
        const spot = firstFit(room, current.id, placed);
        if (spot) {
          setPlaced([...placed, spot]);
          say(null);
        } else say(null, `No space for the ${pieceById(current.id).name.toLowerCase()}`);
      }
      setSelected(current.id);
      if (current.fromRoom && event.currentTarget instanceof SVGElement) event.currentTarget.focus();
      return;
    }

    const spot = locate(event.clientX, event.clientY);
    if (!onFloor(spot, room)) {
      say(null);
      setSelected((id) => (id === current.id ? null : id));
      setPlaced((items) => items.filter((item) => item.id !== current.id));
      return;
    }
    const fit = checkFit(room, spot, current.id, current.turn, others(current.id));
    setSelected(current.id);
    if (!fit.ok) {
      say(fit);
      return;
    }
    say(null);
    setPlaced([...others(current.id), { id: current.id, u: spot.u, v: spot.v, turn: current.turn }]);
  }

  function nudge(id: PieceId, du: number, dv: number) {
    const item = placed.find((entry) => entry.id === id);
    if (!item) return;
    const spot = { u: item.u + du, v: item.v + dv };
    const fit = checkFit(room, spot, id, item.turn, others(id));
    if (!fit.ok) {
      say(fit);
      return;
    }
    say(null);
    setPlaced([...others(id), { ...item, ...spot }]);
  }

  /** Enter or Space on a palette piece: same as a tap, place it at the first spot that fits. */
  function placeByKey(id: PieceId) {
    if (placed.some((item) => item.id === id)) {
      setSelected(id);
      return;
    }
    const spot = firstFit(room, id, placed);
    if (spot) {
      setPlaced([...placed, spot]);
      setSelected(id);
      say(null);
    } else say(null, `No space for the ${pieceById(id).name.toLowerCase()}`);
  }

  function rotate(id: PieceId, dir: -1 | 1 = 1) {
    const item = placed.find((entry) => entry.id === id);
    if (!item) return;
    const turn = stepTurn(item.turn, dir);
    const fit = checkFit(room, item, id, turn, others(id));
    if (!fit.ok) {
      say(fit);
      return;
    }
    say(null);
    setPlaced([...others(id), { ...item, turn }]);
  }

  /** Keeps what still fits in the new room and says what had to come out. */
  function switchRoom(next: RoomId) {
    if (next === roomId) return;
    cancelDrag();
    const { kept, dropped } = carryOver(placed, room, roomById(next));
    setRoomId(next);
    setPlaced(kept);
    setSelected((id) => (id && kept.some((item) => item.id === id) ? id : null));
    const names = dropped.map((id) => pieceById(id).name);
    say(null, names.length ? `${names.join(", ")} ${names.length === 1 ? "doesn't" : "don't"} fit here` : null);
  }

  const dragSpot = drag ? locate(drag.x, drag.y) : null;
  const dragOutside = drag ? !onFloor(dragSpot, room) : false;
  const dragFit = drag && dragSpot && !dragOutside ? checkFit(room, dragSpot, drag.id, drag.turn, others(drag.id)) : null;

  let verdict = "Drag a piece onto the floor";
  let tone: Tone = "idle";
  const shown = dragFit && !dragFit.ok ? dragFit : !drag ? miss : null;
  if (drag && dragOutside) {
    verdict = drag.fromRoom ? "Out of the room" : "Drop it on the floor";
    tone = drag.fromRoom ? "miss" : "idle";
  } else if (shown) {
    verdict = missText(shown);
    tone = "miss";
  } else if (!drag && notice) {
    verdict = notice;
    tone = "miss";
  } else if (dragFit || placed.length > 0) {
    verdict = "Fits in this example";
    tone = "fit";
  }
  const hitId = shown && shown.reason !== "wall" ? shown.hit : null;

  return { svgRef, room, view, placed, drag, selected, verdict, tone, hitId, dragOk: !!dragFit?.ok, startDrag, cancelDrag, finishDrag, nudge, rotate, switchRoom, placeByKey };
}
