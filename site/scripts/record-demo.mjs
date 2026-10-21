// Records the landing-page room demo and writes a sped-up clip to media/nook-demo-fast.mp4.
//
// Usage (from site/): npm run build && node scripts/record-demo.mjs
// Options: --url <http://...>  use a server that is already running instead of starting vite preview
//          --keep-raw         keep the raw webm next to the mp4
// Needs: ffmpeg and ffprobe on PATH, Google Chrome (or set NOOK_CHROME to a Chrome/Chromium binary).
// Playwright is not a site dependency: playwright-core is installed once into a temp folder
// outside the repo (NOOK_PW_DIR overrides the folder).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PW_VERSION = "1.56.1";
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.resolve(SITE, "..", "media");
const OUT = path.join(OUT_DIR, "nook-demo-fast.mp4");
const VIEW = { width: 1280, height: 800 };
const TARGET_SECONDS = 20;
const args = process.argv.slice(2);
const t0 = Date.now();
const log = (text) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${text}`);
const argUrl = args.includes("--url") ? args[args.indexOf("--url") + 1] : null;

// Room sizes in feet, matching the example rooms in src/components/room/rooms.ts.
const ROOM_FT = { "dorm-single": [11, 12], studio: [15, 13], shared: [12, 16] };

function loadPlaywright() {
  const dir = process.env.NOOK_PW_DIR || path.join(os.tmpdir(), "nook-recorder-pw");
  const req = createRequire(path.join(dir, "package.json"));
  try {
    return req("playwright-core");
  } catch {
    log(`Installing playwright-core@${PW_VERSION} into ${dir}`);
    mkdirSync(dir, { recursive: true });
    execFileSync("npm", ["i", "--no-save", "--no-package-lock", "--silent", `playwright-core@${PW_VERSION}`], { cwd: dir, stdio: "inherit" });
    return req("playwright-core");
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startPreview() {
  if (!existsSync(path.join(SITE, "dist", "index.html"))) throw new Error("No site/dist build. Run npm run build first.");
  const port = await freePort();
  const vite = path.join(SITE, "node_modules", ".bin", "vite");
  const child = spawn(vite, ["preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: SITE, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => child.kill("SIGTERM") };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill("SIGTERM");
  throw new Error("vite preview did not start");
}

// A visible dot that follows the mouse, since headless recordings have no cursor.
const CURSOR = `addEventListener("DOMContentLoaded", () => {
  const dot = document.createElement("div");
  dot.style.cssText = "position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(30,30,30,.35);border:2px solid #fff;pointer-events:none;left:-40px;top:-40px;transition:transform .1s";
  document.body.appendChild(dot);
  addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => { dot.style.transform = "scale(.7)"; }, true);
  addEventListener("mouseup", () => { dot.style.transform = ""; }, true);
});`;

async function record(chromium, url, videoDir) {
  const launch = process.env.NOOK_CHROME ? { executablePath: process.env.NOOK_CHROME } : { channel: "chrome" };
  const browser = await chromium.launch({ ...launch, headless: true });
  const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir: videoDir, size: VIEW } });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#sketch").evaluate((el) => {
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -32);
  });
  // The clip is cropped to the demo section (plus a margin), not the whole viewport.
  const box = await page.locator("#sketch").boundingBox();
  const even = (n) => 2 * Math.round(n / 2);
  const x0 = Math.max(0, box.x - 28);
  const y0 = Math.max(0, box.y - 20);
  const crop = {
    x: even(x0),
    y: even(y0),
    w: even(Math.min(VIEW.width, box.x + box.width + 28) - x0),
    // Headless Chrome leaves a gray strip at the bottom of the recorded frame, so stay above it.
    h: even(Math.min(VIEW.height - 100, box.y + box.height + 12) - y0),
  };
  const mouse = page.mouse;
  let at = { x: VIEW.width / 2, y: VIEW.height - 40 };
  // Holds keep the cursor dot wiggling by 2 px, so every held moment has changing frames.
  // The encoder later drops frozen frames, which removes stalls from a busy machine.
  async function wait(ms) {
    const end = Date.now() + ms;
    for (let i = 0; Date.now() < end; i += 1) {
      await mouse.move(at.x + (i % 2 ? 2 : -2), at.y);
      await page.waitForTimeout(80);
    }
    await mouse.move(at.x, at.y);
  }
  await wait(900);
  async function glide(x, y, steps = 18) {
    await mouse.move(x, y, { steps });
    at = { x, y };
  }
  async function centerOf(selector) {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`Not visible: ${selector}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  // Screen point for a spot on the floor, given in feet from the back-left corner.
  async function floorPoint(roomId, uFt, vFt) {
    const [w, d] = ROOM_FT[roomId];
    return page.locator('[data-testid="room-floor"]').evaluate((poly, [fu, fv]) => {
      const m = poly.getScreenCTM();
      const p = Array.from(poly.points).map((q) => ({ x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f }));
      const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      return mix(mix(p[0], p[1], fu), mix(p[3], p[2], fu), fv);
    }, [uFt / w, vFt / d]);
  }
  const verdict = () => page.locator('[data-testid="fit-verdict"]');
  async function drag(id, target, hold = 350) {
    const placed = page.locator(`[data-testid="placed-${id}"]`);
    const from = (await placed.count()) ? await centerOf(`[data-testid="placed-${id}"]`) : await centerOf(`[data-testid="piece-${id}"]`);
    await glide(from.x, from.y, 12);
    await mouse.down();
    await glide(target.x, target.y, 24);
    await wait(hold);
    const during = await verdict().textContent();
    await mouse.up();
    await wait(450);
    return during;
  }
  // Drags a piece over the candidate spots (in feet) and lets go on the first one that fits.
  async function place(roomId, id, spots) {
    const [w, d] = ROOM_FT[roomId];
    const grid = [];
    for (let v = 0.2; v < 0.9; v += 0.2) for (let u = 0.2; u < 0.9; u += 0.2) grid.push([u * w, v * d]);
    const from = (await page.locator(`[data-testid="placed-${id}"]`).count()) ? `placed-${id}` : `piece-${id}`;
    const start = await centerOf(`[data-testid="${from}"]`);
    await glide(start.x, start.y, 12);
    await mouse.down();
    for (const [u, v] of [...spots, ...grid]) {
      const p = await floorPoint(roomId, u, v);
      await glide(p.x, p.y, 16);
      await wait(180);
      if ((await verdict().getAttribute("data-tone")) === "fit") {
        await wait(200);
        await mouse.up();
        await wait(450);
        log(`  ${id}: placed at ${u.toFixed(1)},${v.toFixed(1)} ft`);
        return [u, v];
      }
    }
    await mouse.up();
    await wait(450);
    log(`  ${id}: no spot fit (${await verdict().textContent()})`);
    return null;
  }
  async function showMiss(id, target) {
    const during = await drag(id, target, 1100);
    log(`  ${id}: miss shown "${during}"`);
    await wait(500);
  }
  async function turn(id) {
    if (!(await page.locator(`[data-testid="placed-${id}"]`).count())) return;
    const p = await centerOf(`[data-testid="placed-${id}"]`);
    await glide(p.x, p.y, 10);
    await mouse.down();
    await mouse.up();
    await wait(300);
    const button = page.locator('[data-testid="turn-right"]');
    if (!(await button.count())) return;
    const b = await centerOf('[data-testid="turn-right"]');
    await glide(b.x, b.y, 10);
    await mouse.down();
    await mouse.up();
    await wait(600);
    log(`  ${id}: turned, verdict "${await verdict().textContent()}"`);
  }
  async function switchRoom(roomId) {
    const b = await centerOf(`[data-testid="room-option-${roomId}"]`);
    await glide(b.x, b.y, 16);
    await mouse.down();
    await mouse.up();
    await page.locator(`[data-testid="room-drop"][data-room="${roomId}"]`).waitFor();
    await wait(900);
    log(`${roomId}: switched, verdict "${await verdict().textContent()}"`);
  }

  log("dorm-single");
  await place("dorm-single", "bed", [[9, 5], [9, 6]]);
  await place("dorm-single", "desk", [[5, 4], [5, 5]]);
  await showMiss("fridge", await floorPoint("dorm-single", 1.5, 10.3));
  await place("dorm-single", "fridge", [[1.5, 4], [1.5, 5.5]]);
  await place("dorm-single", "dresser", [[5, 10], [6, 9]]);
  await turn("dresser");
  await wait(600);

  await switchRoom("studio");
  await place("studio", "loveseat", [[7.5, 11], [9, 10.5], [5, 11]]);
  await place("studio", "bookshelf", [[5, 1.3], [10, 4], [4, 4]]);
  await showMiss("nightstand", await floorPoint("studio", 13, 1.5));
  await place("studio", "nightstand", [[13, 6], [13, 8], [12, 11]]);
  await turn("nightstand");
  await wait(600);

  await switchRoom("shared");
  const bedAt = await place("shared", "bed", [[9.5, 8], [9, 6]]);
  await place("shared", "bookshelf", [[5.5, 1], [6, 3]]);
  await place("shared", "loveseat", [[6, 13.5], [7, 12]]);
  if (bedAt) await showMiss("nightstand", await floorPoint("shared", bedAt[0], bedAt[1]));
  await showMiss("fridge", await floorPoint("shared", 1, 7.5));
  await turn("desk");
  await glide(VIEW.width - 60, at.y, 12);
  await wait(1200);

  await context.close();
  await browser.close();
  if (errors.length) log(`Console errors: ${errors.join(" | ")}`);
  return { raw: await page.video().path(), crop };
}

function seconds(file) {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
}

async function main() {
  const { chromium } = loadPlaywright();
  const server = argUrl ? { url: argUrl, stop: () => {} } : await startPreview();
  const videoDir = mkdtempSync(path.join(os.tmpdir(), "nook-demo-"));
  let raw;
  let crop;
  try {
    ({ raw, crop } = await record(chromium, server.url, videoDir));
  } catch (error) {
    rmSync(videoDir, { recursive: true, force: true });
    throw error;
  } finally {
    server.stop();
  }
  try {
  // Pass 1 drops frozen frames and re-times what is left at 30 fps. Pass 2 speeds it up.
  const trimmed = path.join(videoDir, "trimmed.mp4");
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", raw, "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},fps=30,mpdecimate,setpts=N/30/TB`,
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", trimmed,
  ], { stdio: "inherit" });
  const rawSeconds = seconds(raw);
  const activeSeconds = seconds(trimmed);
  const factor = Math.max(1, activeSeconds / TARGET_SECONDS);
  mkdirSync(OUT_DIR, { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", trimmed,
    "-vf", `setpts=PTS/${factor.toFixed(3)},fps=30,format=yuv420p`,
    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", OUT,
  ], { stdio: "inherit" });
  if (args.includes("--keep-raw")) execFileSync("cp", [raw, path.join(OUT_DIR, "nook-demo-raw.webm")]);
  } finally {
    // Runs even when ffmpeg fails, so no nook-demo-* folder is left in the temp dir.
    rmSync(videoDir, { recursive: true, force: true });
  }
  const mb = statSync(OUT).size / 1e6;
  log(`Crop ${crop.w}x${crop.h} at ${crop.x},${crop.y}. Raw ${rawSeconds.toFixed(1)} s, ${activeSeconds.toFixed(1)} s with frozen frames dropped, sped up ${factor.toFixed(2)}x -> ${OUT} (${seconds(OUT).toFixed(1)} s, ${mb.toFixed(2)} MB)`);
  if (mb > 8) throw new Error("Clip is over 8 MB");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
