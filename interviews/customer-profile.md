# Customer profile (hypotheses to test)

> **DRAFT. Not agreed by the team.** Every line below is a guess we want interviews to confirm or kill. Nothing here is a finding. Edit it freely.

Where each guess comes from:

- "Students moving into a dorm or an apartment", starting at UW: the pitch line in the [README](../README.md) and the landing page in [site/](../site/).
- The price points ($14.99 Moving Pass, $54.99 a year, free up to 3 placed pieces): a pricing hypothesis TJ shared for the pitch. It is not recorded in [docs/decisions](../docs/decisions/README.md) or anywhere else in this repository yet, so treat it as unconfirmed until the team writes it down.
- Everything else: our own guess, written so an interview can prove it wrong.

## Hypotheses

| # | Hypothesis | Interview question that tests it | It is wrong if most people say... |
| --- | --- | --- | --- |
| H1 | **Who.** Renters and students furnishing a place, starting with UW students (on campus and off campus), move often enough to care. | "When did you last move? And the time before that?" | They moved once in years, or someone else handled all the furniture. |
| H2 | **Trigger moment.** The problem shows up when a big piece has to fit a new room: buying it before seeing the room, or carrying it in on move-in day. | "Tell me about the last time you moved. What did you bring, and what did you buy for the new place?" | Nothing they moved or bought was ever a fit question. |
| H3 | **The pain is real.** At least one piece did not fit, or they worried it would not, and it cost them time or money. | "Did anything not fit, or nearly not fit? What happened next? What did that cost you?" | Nothing went wrong, or it was a shrug, not a cost. |
| H4 | **Current workaround.** Today they guess, use a tape measure, ask a roommate to check, or look at the listing's floor plan. | "Before you moved it in, how did you check it would fit? Did you measure anything?" | They already measure with a tape and are happy with that. |
| H5 | **They would try it.** They would leave an email for an early list. | "We are putting together an early list. Would you like to be on it?" (yes/no, asked at the end) | No, or yes only to be polite (then ask for the email on the spot). |
| H6 | **They would pay per move.** About $14.99 for one move (Moving Pass) is acceptable. | "What did you spend on your last move, all in? If something like this had saved you that trouble, would $14.99 for that move have been worth it?" (yes/maybe/no) | No, or only if free. |
| H7 | **Free tier is enough to hook them.** Placing up to 3 pieces for free shows enough value to make someone want more. | "How many big pieces did you move or buy last time? Which ones were you unsure about?" | They only had 1 to 3 unsure pieces, so the free tier covers everything (good for adoption, bad for paying). |
| H8 | **Yearly plan.** $54.99 a year appeals to people who move or rearrange more than once a year. | "How many times in the past year did you move, or rearrange a room enough to move big furniture?" | Nobody moves or rearranges more than once a year. |

## Segments we will label each interview with

- **on-campus:** a student living in UW housing, now or for the coming move.
- **off-campus:** a student renting off campus.
- **non-student renter:** a renter who is not a student.

## Results

| Measure | Count | Percent of interviews |
| --- | --- | --- |
| Interviews logged | | |
| Moved in the last 12 months | | |
| Moving in the next 12 months | | |
| Had a fit problem on the last move | | |
| Would join the early list (yes) | | |
| Would pay $14.99 per move: yes | | |
| Would pay $14.99 per move: maybe | | |
| Would pay $14.99 per move: no | | |
| Mean interest (1 to 5) | | n/a |

Counts come from [tally.csv](tally.csv): log each interview there, then run `node interviews/tally.mjs` from the repository root and copy the numbers in. No interviews have been logged yet, so the table is empty on purpose.

A "yes" in an interview is a weak signal. An email left on the early list, or money paid, is a strong one. When the landing page form has responses, count those separately and say which is which.
