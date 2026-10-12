# Nook

> **Draft.** Everything in this repository is a starting point for the team to edit. Nothing here is decided.

Nook is our BUS 444 (UW Bothell, Autumn 2026) team project, described on the team page as a "room digitizer". The idea it grew from: a room scanner for students, framed as "know it fits before you move it". *(Draft wording. Replace with the team's own.)*

## Status

- A shared place for the team's work, with draft notes written as options and open questions.
- A small web prototype, a draft sample, that measures things on a floor from one photo: a distance, a room outline with a plan from above, and a simple "will it fit" example. It is something to react to, not a product direction. It has been driven by script in a headless laptop browser (Chromium), at phone size and at desktop size, on made-up pictures. Nobody has used it by hand on a phone. It has never been tried on a real phone, a real photo or against a tape measure.
- No product decisions are recorded here. See [docs/decisions](docs/decisions/README.md) for how to record one.

## Run the prototype

You need Node.js 22.12 or newer and `npm`.

On a laptop:

```sh
cd prototype
npm ci          # install the exact versions in package-lock.json
npm run dev     # start the local server
```

Open the `Local` address it prints. Press "Try the sample" to see the whole flow on a made-up floor with no photo of your own, or use "Choose photo" to pick a picture.

On a phone, over the local network:

1. Put the phone and the laptop on the same Wi-Fi.
2. Run `npm run dev` on the laptop. It also prints a `Network` address, something like `http://192.168.1.23:5173/`.
3. Type that address into the phone's browser. "Take photo" should open the camera. "Try the sample" needs no camera.
4. Stop the server with Ctrl+C when you are done. While it runs, anyone on that network can open the page.

The page uses an ordinary file picker, not live camera access, so it should work over plain `http` on a local network. Nobody has tried it on a real phone yet. If it does not work on yours, please add what you saw to [docs/open-questions.md](docs/open-questions.md). If the phone cannot reach the address at all, the network may be keeping the two devices apart. We have not tested which networks do. A phone's own hotspot, shared by the laptop and the phones, may get round that. That is untested too.

To check a change before a pull request, run the same four steps GitHub runs, inside `prototype/`:

```sh
npm ci && npm run check && npm test && npm run build
```

### How to use it

Lay one sheet of US Letter or A4 paper flat on the floor. Take a photo with the whole sheet and what you want to measure in view. Tap the four corners of the sheet. Zoom in first (pinch, the mouse wheel, or the plus button): a tap made zoomed out counts as far less exact, and the page will often refuse to give a number. Then pick a tab:

| Tab | What you do | What you get |
| --- | --- | --- |
| Distance | Tap two spots on the floor. | The distance between them, with an error bar. |
| Room | Tap the corners where the walls meet the floor, in order, going round. Tap the first corner again, or press "Close outline". | Each wall, the perimeter and the floor area, each with an error bar or the reason there is none. A plan from above, drawn only when every wall has a number. Buttons that save the plan as an SVG file and the walls as a CSV file. Every row of the CSV says it is a draft that was not checked. |
| Fit | Tap the two sides of a gap and type a width and a depth. If you closed an outline on the Room tab, drag the dashed box on the photo. | "Fits", "does not fit" or "too close to call" for the gap, and whether the box is inside the outline. Floor only: it says nothing about height. This tab is one example of what a measured outline allows, not the point of the sample. |

Under "Tighter accuracy" you can add a second sheet (four more taps) or one known length (two taps and a typed length). In made-up scenes they narrowed the error bars far from the first sheet. Whether they do in a real photo is not known. The page takes a paper size and a typed length as exact and does not check them.

Every result comes with words that say what its error bar covers and leaves out. Nothing has been checked against a tape measure. Your photo stays on your device. Nothing is uploaded. The SVG and CSV files are made in the browser.

## What is in this repository

| Path | What it is |
| --- | --- |
| [docs/product-brief.md](docs/product-brief.md) | Draft brief. What the prototype does and does not do, what is known about its accuracy, and headings for the team to fill. |
| [docs/capture-options.md](docs/capture-options.md) | Three ways to capture a room, compared. No winner picked. |
| [docs/open-questions.md](docs/open-questions.md) | Questions we have not answered, and who could answer each. |
| [docs/decisions/](docs/decisions/README.md) | One file per team decision. Empty so far. |
| [research/](research/README.md) | Sources and notes. |
| [interviews/](interviews/README.md) | Customer interview notes. Read the consent rule first. |
| [prototype/](prototype/) | The web prototype (Vite and TypeScript). |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to make a change, for people new to git. |

## Team

Names as listed on the team page on 2026-10-05, in no particular order:

- Nathan Guirgis
- Aryan Khanna
- Matthias Thesmann
- Habiba Elswify
- Tarang Jammalamadaka (TJ)

Roles: to be agreed by the team.

## Key dates

Dates from the syllabus as TJ recorded them. **Check Canvas**, which is the source of truth.

| Date | What |
| --- | --- |
| Mon 2026-10-12, 11:00 AM | Team contract due |
| Wed 2026-10-14 | First team pitch |
| Wed 2026-10-28 | Customer interviews due (first round) |
| Wed 2026-11-25 | Customer interviews due (second round) |
| Wed 2026-12-02 | Business model canvas |
| Wed 2026-12-09 | Final pitch to judges |

The team's contract, pitch and canvas are the team's own documents and are not written here. Link them from [docs/product-brief.md](docs/product-brief.md) once they exist.

## Open questions

The short list. Details in [docs/open-questions.md](docs/open-questions.md).

- Who on the team has an iPhone or iPad with LiDAR?
- What was decided on the 2026-10-08 call? It is not recorded here.

## How to contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Short version: make a branch, change something, open a pull request, ask a teammate to look. Editing a document counts as contributing. You do not need to code.

## Licence

There is no licence file. Which licence to use, if any, is for the team to decide. Until then, all rights stay with the authors.
