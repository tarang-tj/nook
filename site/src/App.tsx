import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { Signup } from "./components/Signup";
import { Story } from "./components/Story";

export function App() {
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <Header />
      <main id="content">
        <Hero />
        <Marquee />
        <Story />
        <Signup />
      </main>
      <Footer />
    </>
  );
}
