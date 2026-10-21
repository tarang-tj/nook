# Media

`nook-demo-fast.mp4` is a sped-up recording (20 seconds, 668x592, no sound, cropped to the demo from a 1280x800 window) of the landing-page room demo. It goes through all three example rooms (dorm single, studio, shared room): pieces get dragged in and turned, pieces that don't fit show the reason ("Blocks the door", "Hits the twin bed", "Hits the radiator"), and pieces carry over when the room changes.

To make it again (needs ffmpeg and Google Chrome): `cd site && npm ci && npm run build && node scripts/record-demo.mjs`. The script starts `vite preview` on a free port, records the demo with playwright-core (installed once into a temp folder, not into the repo), trims frozen frames, speeds the rest up, and overwrites the mp4.
