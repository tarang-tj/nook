# Open questions

> **DRAFT.** Add questions freely. When one is answered, move the answer into [decisions](decisions/README.md) if it is a decision, or note the answer and its source here.

## About the team and the course

| Question | Who could answer it |
| --- | --- |
| What was decided on the 2026-10-08 call? Nothing from it is recorded in this repository. | Anyone who was on the call |
| What roles does each person want? Roles are not recorded anywhere we can see. | The team, together |
| What is the course policy on AI-written text in graded documents? For AI-written code, TJ said on 2026-10-12 that the course has no policy. That answer did not cover text. | The instructor, or the syllabus on Canvas |
| Are the dates in the README right? They are from TJ's notes of the syllabus. | Anyone, by checking Canvas |
| Where do the team's documents live (contract, pitch, canvas)? Should this repository link to them? | The team |
| Does the team want this repository at all, or would a shared drive suit everyone better? | The team |
| Which licence, if any, should the code have? | The team |

## About hardware

| Question | Who could answer it |
| --- | --- |
| Who has an iPhone or iPad with LiDAR? | Each teammate |
| Which iPhone and iPad models have LiDAR? We have not looked it up. | Anyone, from Apple's own pages |
| Who has an Android phone, and which one? | Each teammate |
| RoomPlan is a framework for iOS apps. What does building one take, and does anyone have it? | Anyone, from Apple's developer pages, then each teammate |
| Is "build something later" (our own hardware) realistic within this quarter? | The team, with the instructor |

## About the prototype

| Question | Who could answer it |
| --- | --- |
| Does it open and work on a real iPhone and a real Android phone? It has only been run in a laptop browser (Chrome), at phone size and desktop size, with scripted taps on made-up pictures. Safari has not been tried at all. | Anyone with a phone and ten minutes |
| How close is it to a tape measure in a real room? Nobody has checked. | Anyone with a tape measure and a sheet of paper |
| Do phone photos come in the right way up? | Whoever tries it on a phone |
| Is the assumed tap accuracy (about 1.5 screen pixels) realistic for a finger? It is an assumption carried over from SPECTRA. | Whoever tests it: tap the same corner several times and compare |
| Would pinch to zoom make the error bar usefully smaller? In made-up scenes, yes, by a lot: see the accuracy notes in [product-brief.md](product-brief.md). Whether a real finger on a real phone gets the same gain is not known. | Whoever tries it on a phone |
| Does pinch to zoom feel right on a real phone, and can corners be tapped with a thumb? Only scripted touches have been tried. | Anyone with a phone |
| Is there an Android equivalent to RoomPlan? A short search found none. See [capture-options.md](capture-options.md). | Anyone willing to search further |

## About the sample added on 2026-10-12

The prototype grew four ways in one go so the team could see them side by side: easier to try (a made-up sample floor, zoom), a room outline with a plan, a "will it fit" example, and tighter accuracy from a second sheet or a known length. None of these is a decision. The questions they raise:

| Question | Who could answer it |
| --- | --- |
| Which of these four directions, if any, does the team want to keep? Dropping all of them is a fair answer. | The team |
| Is a prototype like this useful to the team at all at this stage, or is it ahead of the customer interviews? | The team |
| The Fit tab builds the original pitch line ("know it fits before you move it"), which the README marks as draft wording. Should it stay in the sample, given that it could read as the product? | The team |
| The Room tab measures where walls meet the floor, which furniture usually hides. Can those corners be seen in a photo of a real, lived-in room? | Anyone with a room and a phone |
| Is a plan with error bars like these useful to anyone? For what? In made-up scenes with one sheet the bars ran from a few percent near the sheet to tens of percent on the far walls. Nothing is known about a real photo. | The team, from interviews |
| Would anyone lay down a second sheet of paper or measure one length with a tape to get a tighter number? If they have a tape, why would they use this? | The team, from interviews |
| The page takes a paper size and a typed length as exact and cannot tell when one is wrong. Is that acceptable, and how should it be said to a user? | The team |
| The page does not know which side of the sheet is long and relies on a person noticing the labels. Is that good enough, or does it need to work that out itself? | Whoever works on the prototype next |
| The page keeps nothing after a reload. Should it? Keeping a photo of someone's room raises privacy questions the team has not discussed. | The team |
| How should teammates open the sample? Today it runs only from a laptop on the same network. Hosting it anywhere would make the team's project public or need accounts, and that is a team decision. | The team |
| More of the measuring code now comes from SPECTRA, which is TJ's and has no open licence. Does that change the licence question above? | The team, with TJ |
| The new parts were written with AI assistance, like the first version. The course has no policy on AI-written code (TJ, 2026-10-12). Does the team want them in graded work? | The team |
| The accuracy counts in the brief come from made-up scenes. Who will do the first check against a tape measure, and what result would make the method not worth pursuing? | The team |

## About customers

*No questions written here on purpose. The interview plan is the team's to write. Link it from [interviews/README.md](../interviews/README.md).*
