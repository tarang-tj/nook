import { motion, useReducedMotion } from "motion/react";
import { GOOGLE_FORM_URL, googleFormEmbed } from "../config";

export function Signup() {
  const reduce = useReducedMotion();
  const raw = GOOGLE_FORM_URL.trim();
  const embed = googleFormEmbed(raw);
  const canEmbed = embed?.includes("docs.google.com") ?? false;

  return (
    <section className="signup" id="join" aria-labelledby="join-title">
      <motion.div
        className="signup-card"
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="eyebrow">Early list</p>
        <h2 id="join-title">Want to try it when there is something to try?</h2>
        <p className="signup-lead">
          Leave your name if you are a student who would use this. We will tell you when there is
          a version worth opening. Joining the list does not buy anything.
        </p>

        {!raw && (
          <p className="form-waiting" role="status">
            The signup form is not linked yet. The join button turns on once a Google Form address
            is added.
          </p>
        )}

        {raw && !embed && (
          <p className="form-waiting" role="status">
            The form link needs to be a Google Form address. The join button stays off until it is.
          </p>
        )}

        {embed && (
          <p className="signup-actions">
            <a className="button primary" href={raw} target="_blank" rel="noreferrer">
              Open the form
            </a>
          </p>
        )}

        {!embed && (
          <p className="signup-actions">
            <button className="button primary" type="button" disabled>
              Join the list
            </button>
          </p>
        )}

        {canEmbed && embed && (
          <iframe className="form-frame" title="Join the Nook list" src={embed} />
        )}
      </motion.div>
    </section>
  );
}
