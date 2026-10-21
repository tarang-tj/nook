import { motion, useReducedMotion } from "motion/react";

const STEPS = [
  {
    n: "01",
    title: "Picture the room",
    body: "Start from the space you are actually moving into, not the wide photo on the listing.",
  },
  {
    n: "02",
    title: "Say what you are moving",
    body: "A bed, a desk, a fridge. The thing you do not want to discover is too wide on the stairs.",
  },
  {
    n: "03",
    title: "See if it fits",
    body: "Get an answer before you rent the van, not after you have already paid for the piece.",
  },
];

export function Story() {
  const reduce = useReducedMotion();

  return (
    <section className="story" id="story" aria-labelledby="story-title">
      <motion.div
        className="story-intro"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="eyebrow">The idea</p>
        <h2 id="story-title">The surprise happens on the stairs.</h2>
        <p>
          The listing looked bigger than it was. The doorway did not. You already bought the
          thing. Nook is for that moment, earlier: students moving into a dorm or an apartment who
          want to know before they lift.
        </p>
      </motion.div>
      <ol className="steps">
        {STEPS.map((step, index) => (
          <motion.li
            key={step.n}
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: reduce ? 0 : index * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="step-n">{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
