# Product brief

> **DRAFT. Not agreed by the team.** This page describes a baseline prototype and lists questions. It does not describe a product the team has chosen to build. Edit it freely.

## What we have been told so far

- The team is called Nook. The team page describes it as a "room digitizer".
- The pitch it grew from was a room scanner for students: "know it fits before you move it".
- TJ's suggestion, as a proposal only: use the phone's own sensors as the main hardware, and leave open building something of our own later.

Anything the team decided on the 2026-10-08 call belongs here and is missing. See [open-questions.md](open-questions.md).

## The baseline prototype

It lives in [`prototype/`](../prototype/). It exists so the team has something concrete to react to. It is not a proposal for what Nook should be. Whether any of what it shows is worth keeping is an open question: see [open-questions.md](open-questions.md).

What it does (draft sample, extended 2026-10-12 so the team has more to react to; none of these is a chosen direction):

- Runs in a phone or laptop browser. Nothing to install on the phone.
- Takes one photo of a floor with one sheet of US Letter or A4 paper lying on it. You tap the four corners of the sheet. The page writes on each edge the length it has assumed for it.
- Has a "Try the sample" button that draws a made-up floor (not a photo of a real room) and can place the taps for you. Because the floor is made up, the page prints the true value beside its own answer.
- Zooms and slides the photo (pinch, mouse wheel, buttons, keyboard), so a tap can be placed more exactly. A tap keeps the uncertainty of the zoom it was made at.
- Has three tabs over the same photo and the same sheet:
  - **Distance:** tap two spots, read the distance between them.
  - **Room:** tap the corners of an outline on the floor in order and close it. It lists each wall, the perimeter and the floor area, draws a plan from above, and saves the plan as an SVG file and the walls as a CSV file. Both files are made in the browser.
  - **Fit:** one example of what a measured outline allows, not the point of the sample. Type a width and a depth. It says "fits", "does not fit" or "too close to call" for a gap between two tapped spots, and whether the thing's footprint, dragged on the photo, is inside the room outline.
- Optionally takes a second sheet (four more taps) or one known length (two taps and a typed length), and solves the floor from all of them together. It shows which of them it used.
- Shows every number with an error bar, in cm or inches, and says in words what the bar covers and what it leaves out.
- When it cannot give an honest number, it says why and shows no number.
- The photo never leaves the device.

What it does not do:

- It does not scan a room. Every number comes from spots a person tapped on one photo of one flat floor.
- It does not measure height, walls, or anything that is not on the floor. A "wall" in the Room tab is the line where a wall meets the floor. "Fits" means on the floor only: it says nothing about height, doors or stairs.
- It does not recognise furniture, doors or windows.
- It does not find the sheet or the room's corners by itself. You tap them.
- It does not check that a reference is right. A paper size and a typed length are taken as exact. If one is wrong the numbers near it are wrong with it, and the error bar does not show it. The page refuses only when two references disagree grossly, which is not the same as checking them.
- It does not know which side of the sheet is the long one. It guesses from the photo and shows its guess on the sheet's edges. A person has to notice a wrong guess and tick "Swap the sheet's long and short sides".
- It does not keep anything. Reloading the page loses the photo and the taps. The SVG and CSV files are the only things that leave the page, and only when you press save.
- It does not correct for lens distortion.

What we know about its accuracy, and how we know:

- **It has never been tried on a real phone, a real photo or against a tape measure.** Everything below comes from made-up scenes, where the camera is ideal and the floor is perfectly flat. Treat every number the page shows as unproven until someone checks it with a tape.
- The maths is tested against made-up scenes where the true answer is known. With exact taps it returns the true values. The tests are in [`prototype/tests/`](../prototype/tests/).
- The error bar comes from simulating slightly misplaced taps (about 1.5 screen pixels off, which is an assumption, not a measurement of real fingers). It covers tap placement only.
- Zoom matters more than anything else on a phone. Fitted to a phone screen, one screen pixel covers about eight photo pixels, so a careful tap is still about 12 photo pixels off, and the page often refuses to give a number. Zoomed right in, the same tap is about 1.5 photo pixels off.
- The bar grows as the spots get further from the sheet. That is why the second sheet and the known length exist.
- How often the bar holds the truth, counted in a made-up scene by retaking the same simulated photo a few hundred times with every tap moved:
  - One sheet, a distance near the sheet, careful taps (1.5 photo pixels): the bar held the true value in 280 of 300 retakes in a made-up scene. Test: `prototype/tests/spread.test.ts`.
  - One sheet, a room outline, careful taps: each wall, the perimeter and the area held in 238 to 242 of 250 retakes in a made-up scene. With sloppy taps (6 photo pixels) most far walls were refused, and the bars still shown were too narrow: the area held in 41 of 52. Test: `prototype/tests/outline.test.ts`.
  - One sheet, a one-metre span about four metres past the sheet, careful taps: the bar held in 273 of 300 retakes in a made-up scene, which is a little less often than a bar of this kind should. With a second sheet near the span it held in 292 of 300, and with a known length near the span in 290 of 300. Test: `prototype/tests/fused-coverage.test.ts`.
  - Fit verdicts for a thing 2 cm larger or smaller than the true gap, careful taps: 1 wrong call in 600 retakes in a made-up scene, and most retakes said "too close to call". Test: `prototype/tests/fit.test.ts`.
- A wrong reference far from the first sheet is believed, not caught. In a made-up scene, an A4 sheet declared as US Letter was accepted and a 250 cm wall then read about 245 ± 4 cm, with the true value outside the bar. Test: `prototype/tests/references.test.ts`.
- From TJ's own SPECTRA project, which uses the same method: with one sheet of paper as the reference, the error bar on a room-sized area is roughly 10 to 25 percent, and a larger known reference tightens it.
- None of these counts says anything about a real room. They are not evidence for a pitch.

## The capture question

How should Nook get the shape of a room into the phone? There are at least three routes, compared in [capture-options.md](capture-options.md). The team has not chosen one. The choice depends on answers we do not have yet, starting with which phones the team and the people we want to serve actually have.

## Customer

*Not written. This is the team's to write, from interviews. Link the team's customer notes here.*

## Problem

*Not written. Link the team's problem statement here.*

## Value

*Not written. Link the team's Lean Canvas or business model canvas here.*

## Team documents

*Link the team contract, pitch deck and canvas here once they exist. They are not kept in this repository unless the team wants them to be.*
