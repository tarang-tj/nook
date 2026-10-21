import { useScroll, useMotionValueEvent } from "motion/react";
import { useState } from "react";

export function Header() {
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setCompact(latest > 12);
  });

  return (
    <header className={compact ? "site-header is-compact" : "site-header"}>
      <a className="wordmark" href="#content">
        Nook
      </a>
      <nav aria-label="Page">
        <a href="#sketch">Try it</a>
        <a href="#story">The idea</a>
        <a className="nav-join" href="#join">
          Join the list
        </a>
      </nav>
    </header>
  );
}
