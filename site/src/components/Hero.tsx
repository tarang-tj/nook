import { motion, useReducedMotion } from "motion/react";
import { RoomSketch } from "./RoomSketch";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease },
        };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <motion.p className="eyebrow" {...rise(0.05)}>
          For students moving in
        </motion.p>
        <motion.h1 id="hero-title" {...rise(0.14)}>
          Know it <em>fits</em> before you move it.
        </motion.h1>
        <motion.p className="lede" {...rise(0.26)}>
          Nook is a room digitizer we are building so you can tell whether a bed, a desk, or a
          fridge belongs in the room before you carry it up the stairs.
        </motion.p>
        <motion.div className="hero-actions" {...rise(0.36)}>
          <a className="button primary" href="#sketch">
            Try the sketch
          </a>
          <a className="button ghost" href="#join">
            Join the list
          </a>
        </motion.div>
      </div>
      <RoomSketch />
    </section>
  );
}
