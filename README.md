# Nook

> **Draft.** Everything in this repository is a starting point for the team to edit. Nothing here is decided.

Nook is our BUS 444 (UW Bothell, Autumn 2026) team project, described on the team page as a "room digitizer". The idea it grew from: a room scanner for students, framed as "know it fits before you move it". *(Draft wording. Replace with the team's own.)*

## Status

- A shared place for the team's work, with draft notes written as options and open questions.
- A small web prototype that measures one distance on a floor from one photo. It is a baseline to react to, not a product direction. It has been run in a laptop browser on a made-up picture. It has not been tried on a real phone, on a real photo, or checked against a tape measure.
- No product decisions are recorded here. See [docs/decisions](docs/decisions/README.md) for how to record one.

## Run the prototype

You need Node.js 22.12 or newer and `npm`.

On a laptop:

```sh
cd prototype
npm ci          # install the exact versions in package-lock.json
npm run dev     # start the local server
```

Open the `Local` address it prints. Use "Choose photo" to pick a picture.

On a phone:

1. Put the phone and the laptop on the same Wi-Fi.
2. Run `npm run dev` on the laptop. It also prints a `Network` address.
3. Open that address in the phone's browser. "Take photo" should open the camera.

The page uses an ordinary file picker, not live camera access, so it should work over plain `http` on a local network. Nobody has tried it on a real phone yet. If it does not work on yours, please add what you saw to [docs/open-questions.md](docs/open-questions.md). If the phone cannot reach the address at all, the network may be keeping the two devices apart. We have not tested which networks do.

How to use it: lay one sheet of US Letter or A4 paper flat on the floor, take a photo with the sheet and the two spots you care about in view, tap the four corners of the sheet, then tap the two spots. The page shows the distance with an error bar and says what the bar covers and leaves out. Your photo stays on your device. Nothing is uploaded.

## What is in this repository

| Path | What it is |
| --- | --- |
| [docs/product-brief.md](docs/product-brief.md) | Draft brief. What the prototype does and does not do, and headings for the team to fill. |
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
- What is the course policy on AI-written code in the graded project?
- What was decided on the 2026-10-08 call? It is not recorded here.

## How to contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Short version: make a branch, change something, open a pull request, ask a teammate to look. Editing a document counts as contributing. You do not need to code.

## Licence

There is no licence file. Which licence to use, if any, is for the team to decide. Until then, all rights stay with the authors.
