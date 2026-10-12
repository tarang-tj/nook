// Where a picture comes from: the camera, a chosen file, or the made-up
// sample floor. A photo is read in the browser and never leaves it.
import { drawSampleFloor } from "../sample/draw";
import { SAMPLE_SIZE } from "../sample/floor";
import { el } from "./dom";
import type { Photo } from "./draw";

export function wirePhotoInputs(use: (photo: Photo, madeUp: boolean) => void, failed: (why: string) => void): void {
  for (const id of ["take", "choose"]) {
    const file = el<HTMLInputElement>(id);
    file.addEventListener("change", () => {
      const chosen = file.files?.[0];
      file.value = ""; // so choosing the same photo again still fires
      if (!chosen) return;
      const url = URL.createObjectURL(chosen);
      const next = new Image();
      next.onload = () => {
        URL.revokeObjectURL(url);
        use({ source: next, w: next.naturalWidth, h: next.naturalHeight }, false);
      };
      next.onerror = () => {
        URL.revokeObjectURL(url);
        failed("That file could not be opened as a photo. Try another one.");
      };
      next.src = url;
    });
  }
  el("sample").addEventListener("click", () => use({ source: drawSampleFloor(), ...SAMPLE_SIZE }, true));
}
