# Product brief

> **DRAFT. Not agreed by the team.** This page describes a baseline prototype and lists questions. It does not describe a product the team has chosen to build. Edit it freely.

## What we have been told so far

- The team is called Nook. The team page describes it as a "room digitizer".
- The pitch it grew from was a room scanner for students: "know it fits before you move it".
- TJ's suggestion, as a proposal only: use the phone's own sensors as the main hardware, and leave open building something of our own later.

Anything the team decided on the 2026-10-08 call belongs here and is missing. See [open-questions.md](open-questions.md).

## The baseline prototype

It lives in [`prototype/`](../prototype/). It exists so the team has something concrete to react to. It is not a proposal for what Nook should be.

What it does:

- Runs in a phone or laptop browser. Nothing to install on the phone.
- Takes one photo of a floor with one sheet of US Letter or A4 paper lying on it.
- You tap the four corners of the sheet, then two spots on the floor.
- It shows the distance between the two spots, in cm or inches, with an error bar.
- It says in words what the error bar covers and what it leaves out.
- When it cannot give an honest number, it says why and shows no number.
- The photo never leaves the device.

What it does not do:

- It does not scan a room. It measures one straight-line distance on one flat surface.
- It does not measure height, walls, or anything that is not on the floor.
- It does not recognise furniture, doors or windows.
- It does not find the sheet by itself. You tap the corners.
- It does not save, export or share anything.
- It does not zoom the photo. On a small screen a tap covers many photo pixels, so the error bar is wide. See below.
- It does not correct for lens distortion.

What we know about its accuracy, and how we know:

- The maths is tested against made-up scenes where the true answer is known. With exact taps it returns the true distance. These tests are in [`prototype/tests/`](../prototype/tests/).
- The error bar comes from simulating slightly misplaced taps. It grows as the spots get further from the sheet. A one-off run on 2026-10-10 in the made-up test scene (a Letter sheet about 440 photo pixels wide) gave, for a 50 cm span: about ±2 cm just past the sheet and about ±6 cm two metres past it, if taps land within 1.5 photo pixels. If taps land within 10 photo pixels, it gave about ±10 cm just past the sheet and refused to give a number two metres past it.
- The second case is closer to a phone. The app assumes a tap is good to about 1.5 screen pixels. A 3000-pixel-wide photo shown 400 pixels wide puts 7.5 photo pixels under each screen pixel, so 1.5 screen pixels is about 11 photo pixels.
- From TJ's own SPECTRA project, which uses the same method: with one sheet of paper as the reference, the error bar on a room-sized area is roughly 10 to 25 percent, and a larger known reference tightens it.
- **Nobody has compared this method with a tape measure yet.** Until someone does, treat every number it shows as unproven.

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
