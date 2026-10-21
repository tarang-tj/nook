# Interviews

Notes from customer interviews go here, one file per interview, along with the team's interview plan once the team has written it. Write down what the person said and did, as close to their words as you can, and keep your own interpretation in a separate section.

**No names or recordings of interviewees in this repository without their consent.** That includes photos, voice recordings, email addresses, phone numbers, and details that would let someone work out who the person is. If you do not have consent, refer to people as "Interviewee 1", "Interviewee 2", and keep the key to those labels outside the repository.

## How to use

Draft files for the team to edit. None of them holds interview results yet.

| File | What it is |
| --- | --- |
| [customer-profile.md](customer-profile.md) | Who we think the customer is, written as hypotheses, each with the question that tests it. Its Results table stays empty until interviews are logged. |
| [interview-guide.md](interview-guide.md) | A 10 to 15 minute script: consent line, screener, questions about the last move, then three interest measures (early list, $14.99 per move, 1 to 5). |
| [template.md](template.md) | A note template for one interview. Copy it to `interview-01.md`, `interview-02.md` and so on. Labels only, no names. |
| [tally.csv](tally.csv) | One row per interview, with the answers in fixed words (yes/no, yes/maybe/no, 1 to 5). |
| [tally.mjs](tally.mjs) | Counts the rows. From the repository root run `node interviews/tally.mjs`. It needs only Node.js, and it names the line of any row it cannot read. |

After each interview: write the note from the template, add one row to `tally.csv`, run the tally, and copy the numbers into the Results table in `customer-profile.md`.
