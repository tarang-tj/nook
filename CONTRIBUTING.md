# Contributing

This is written for people who have not used git before. If something here is unclear, that is a problem with this page: say so, or fix it.

## The idea

This is a suggested way of working. The team can change it. The suggestion: nobody changes the `main` branch directly. You make your change on your own branch, then open a pull request (a "PR") so a teammate can look before it goes in. This applies to documents as much as code.

## Editing a document without installing anything

1. Open the file on GitHub and click the pencil icon ("Edit file") in the upper right of the file view.
2. Make your edit.
3. Click "Commit changes...", write a short message, and choose to commit to a new branch, not to `main`.
4. Open a pull request from that branch and ask a teammate to review it.

GitHub's own page on this, read on 2026-10-10: [Editing files](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files).

## Working on your own computer

One time only:

```sh
git clone https://github.com/tarang-tj/nook.git
cd nook
```

For each change:

```sh
git switch main
git pull                          # get everyone's latest work
git switch -c your-name/short-description
# ... edit files ...
git status                        # see what you changed
git add path/to/the/file
git commit -m "docs: add interview questions"
git push -u origin your-name/short-description
```

Then open the link that `git push` prints and press "Create pull request". Say in a sentence or two what you changed and why.

Commit messages start with a short label: `docs:` for documents, `feat:` for a new capability, `fix:` for a repair, `test:` for tests, `chore:` for housekeeping.

## Checks for the prototype

If you changed anything under `prototype/`, run these before you push:

```sh
cd prototype
npm ci           # install exact versions
npm run check    # type check
npm test         # run the tests
npm run build    # make sure it still builds
```

GitHub runs the same four steps on every push and pull request. A red cross on your pull request means one of them failed. Click it to see which.

## What not to put in this repository

- Passwords, API keys or tokens.
- Email addresses or phone numbers, yours or anyone else's.
- Names, recordings or photos of people we interview, unless they have agreed. See [interviews/README.md](interviews/README.md).

## Recording a decision

When the team decides something, add a file under [docs/decisions](docs/decisions/README.md). A decision that is only in a chat thread gets lost.

## About the first version, and what was added on 2026-10-12

The first version of the prototype was written by TJ with AI assistance. Check the course policy before any of it is used in graded work.

The same holds for everything added to the prototype on 2026-10-12: the zoom and pan, the press rules for touch, the made-up sample floor, the Room and Fit tabs, the plan and its SVG and CSV files, the second sheet and known length, the changes made after a review of the sample the same day, and the tests for all of them. All of it was written by TJ with AI assistance. So were the edits made the same day to the README, the product brief and the open questions. None of it has been reviewed by a teammate yet. Check the course policy before any of it is used in graded work.

Much of the measuring code is adapted from TJ's own SPECTRA project, as the comment at the top of each file says. What that means for a licence is an open question in [docs/open-questions.md](docs/open-questions.md).
