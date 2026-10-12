// WebXR wrapper for the corner-walk room scan.
//
// This module is the only place in the prototype that touches the WebXR API.
// It manages one immersive-ar session: a hit-test loop places a reticle at the
// surface the phone is pointing at; each tap records a floor corner. After the
// outline is closed the next tap records the ceiling height. Then the session
// ends and the page draws the 3-D room.
//
// Works on Chrome for Android with ARCore when the page is opened over HTTPS.
// iPhone Safari, Firefox, and plain http will hit the "not supported" path.
// The page offers the sample room in that case.
//
// TypeScript 5.9's DOM lib does not include WebXR types, so we declare the
// minimal subset we use here. These are draft declarations, not validated
// against the full spec.

import { isNearFirst, type Pt3 } from "./geometry";

// ─── Minimal WebXR type declarations ────────────────────────────────────────

type XrSessionMode = "immersive-ar" | "immersive-vr" | "inline";

interface XrSystem {
  isSessionSupported(mode: XrSessionMode): Promise<boolean>;
  requestSession(mode: XrSessionMode, options?: Record<string, unknown>): Promise<XrSession>;
}

interface XrReferenceSpace {
  readonly type: string;
}

interface XrHitTestSource {
  cancel(): void;
}

interface XrHitTestResult {
  getPose(space: XrReferenceSpace): XrPose | null;
}

interface XrPose {
  readonly transform: { readonly matrix: Float32Array };
}

interface XrWebGlLayerInit {
  alpha?: boolean;
}

interface XrWebGlLayerCtor {
  new(session: XrSession, gl: WebGLRenderingContext, init?: XrWebGlLayerInit): XrWebGlLayer;
}

interface XrWebGlLayer {
  readonly framebuffer: WebGLFramebuffer;
}

interface XrRenderState {
  readonly baseLayer: XrWebGlLayer | null;
}

interface XrSession extends EventTarget {
  readonly renderState: XrRenderState;
  requestReferenceSpace(type: string): Promise<XrReferenceSpace>;
  requestHitTestSource(opts: { space: XrReferenceSpace }): Promise<XrHitTestSource>;
  requestAnimationFrame(cb: (time: number, frame: XrFrame) => void): number;
  updateRenderState(state: { baseLayer?: XrWebGlLayer }): Promise<void>;
  end(): Promise<void>;
}

interface XrFrame {
  getHitTestResults(source: XrHitTestSource): XrHitTestResult[];
  requestAnimationFrame?(cb: (time: number, frame: XrFrame) => void): number;
}

// Extend Navigator with xr property.
declare global {
  interface Navigator {
    readonly xr?: XrSystem;
  }
  const XRWebGLLayer: XrWebGlLayerCtor;
}

// ─── Public types ────────────────────────────────────────────────────────────

export type ScanPhase = "floor" | "height" | "done";

export type ScanSessionCallbacks = {
  /** Called whenever a floor corner is added. */
  onCorners(corners: Pt3[]): void;
  /** Called when the phase changes. */
  onPhase(phase: ScanPhase): void;
  /** Called every animation frame with the current hit-test position.
   * `null` when no surface was found. */
  onReticle(pos: Pt3 | null): void;
  /** Called with the finished room data when the session ends normally. */
  onComplete(corners: Pt3[], height: number, heightSource: "measured" | "typed"): void;
  /** Called when the session ends for any reason. */
  onEnd(): void;
};

export type ScanController = {
  end(): void;
  undoLast(): void;
  closeOutline(): void;
};

// ─── Support check ──────────────────────────────────────────────────────────

/** Check whether immersive-ar with hit-test is available on this device.
 * Returns a user-readable reason when it is not. */
export async function checkArSupport(): Promise<{ supported: boolean; reason?: string }> {
  if (!window.isSecureContext)
    return {
      supported: false,
      reason:
        "AR needs HTTPS. Open the page over a local HTTPS address " +
        "(run \u201cnpm run dev:https\u201d and accept the certificate on your phone).",
    };
  if (!("xr" in navigator) || !navigator.xr)
    return { supported: false, reason: "This browser does not support WebXR. Try Chrome for Android." };
  try {
    const ok = await navigator.xr.isSessionSupported("immersive-ar");
    if (!ok)
      return {
        supported: false,
        reason:
          "AR is not available on this device. " +
          "Try an Android phone with ARCore support.",
      };
    return { supported: true };
  } catch {
    return { supported: false, reason: "The AR support check failed. Try Chrome for Android over HTTPS." };
  }
}

// ─── Session ────────────────────────────────────────────────────────────────

/**
 * Start an immersive-ar WebXR session.
 *
 * `overlayRoot` is the DOM element shown on top of the camera (dom-overlay).
 * Returns a controller on success, or null when the session could not start
 * (in which case `callbacks.onEnd` is also called).
 */
export async function startScanSession(
  overlayRoot: HTMLElement,
  callbacks: ScanSessionCallbacks,
): Promise<ScanController | null> {
  if (!navigator.xr) {
    callbacks.onEnd();
    return null;
  }

  // We need a WebGL context for the XRWebGLLayer even though we render
  // nothing — the camera passthrough fills the background and the DOM overlay
  // handles all the UI.
  const glCanvas = document.createElement("canvas");
  const gl =
    (glCanvas.getContext("webgl2") as WebGLRenderingContext | null) ??
    (glCanvas.getContext("webgl") as WebGLRenderingContext | null);
  if (!gl) {
    callbacks.onEnd();
    return null;
  }

  let session: XrSession | null = null;
  let hitTestSource: XrHitTestSource | null = null;
  let rafId = 0;
  let phase: ScanPhase = "floor";
  let corners: Pt3[] = [];
  let closed = false;

  const endSession = () => {
    hitTestSource?.cancel();
    hitTestSource = null;
    if (session) {
      session.end().catch(() => undefined);
      session = null;
    }
    callbacks.onEnd();
  };

  try {
    // dom-overlay is requested as an optional feature; the cast to
    // Record<string, unknown> satisfies the minimal XrSystem.requestSession
    // signature without needing full XRSessionInit types.
    session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local-floor"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: overlayRoot },
    } as Record<string, unknown>);
  } catch {
    callbacks.onEnd();
    return null;
  }

  // Minimal WebGL layer — clear to transparent so the camera shows through.
  // XRWebGLLayer is not in the TypeScript DOM lib; we access it via a typed
  // local alias so the cast is constrained to this one call site.
  const WebXrLayer = XRWebGLLayer as unknown as new (s: unknown, g: unknown) => XrWebGlLayer;
  await session.updateRenderState({ baseLayer: new WebXrLayer(session, gl) });

  let localFloor: XrReferenceSpace;
  try {
    localFloor = await session.requestReferenceSpace("local-floor");
  } catch {
    endSession();
    return null;
  }

  const viewerSpace = await session.requestReferenceSpace("viewer");

  try {
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  } catch {
    endSession();
    return null;
  }

  // ── Animation frame loop ──────────────────────────────────────────────────

  const onFrame = (_time: number, frame: XrFrame) => {
    if (!session) return;
    rafId = session.requestAnimationFrame(onFrame);

    // Clear the WebGL framebuffer to transparent each frame.
    const layer = session.renderState.baseLayer;
    if (layer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    const results = hitTestSource ? frame.getHitTestResults(hitTestSource) : [];
    if (results.length > 0) {
      const pose = results[0].getPose(localFloor);
      if (pose) {
        const m = pose.transform.matrix;
        callbacks.onReticle({ x: m[12], y: m[13], z: m[14] });
      } else {
        callbacks.onReticle(null);
      }
    } else {
      callbacks.onReticle(null);
    }
  };

  rafId = session.requestAnimationFrame(onFrame);

  // ── Tap handler ────────────────────────────────────────────────────────────

  const onSelect = () => {
    if (!hitTestSource || !session) return;

    session.requestAnimationFrame((_t: number, frame: XrFrame) => {
      const results = frame.getHitTestResults(hitTestSource!);
      if (results.length === 0) return;
      const pose = results[0].getPose(localFloor);
      if (!pose) return;

      const m = pose.transform.matrix;
      const pt: Pt3 = { x: m[12], y: m[13], z: m[14] };

      if (phase === "floor" && !closed) {
        // Auto-close when the new tap is near the first corner.
        if (isNearFirst(corners, pt)) {
          closed = true;
          phase = "height";
          callbacks.onPhase("height");
        } else {
          corners = [...corners, pt];
          callbacks.onCorners(corners);
        }
      } else if (phase === "height") {
        const h = Math.max(0.1, pt.y);
        phase = "done";
        callbacks.onPhase("done");
        callbacks.onComplete(corners, h, "measured");
        endSession();
      }
    });
  };

  session.addEventListener("select", onSelect);
  session.addEventListener("end", endSession);

  // Suppress the unused rafId lint error: it is set in the animation loop.
  void rafId;

  // ── Controller ────────────────────────────────────────────────────────────

  return {
    end: endSession,

    undoLast() {
      if (phase !== "floor" || corners.length === 0) return;
      corners = corners.slice(0, -1);
      callbacks.onCorners(corners);
    },

    closeOutline() {
      if (phase !== "floor" || corners.length < 3) return;
      closed = true;
      phase = "height";
      callbacks.onPhase("height");
    },
  };
}
