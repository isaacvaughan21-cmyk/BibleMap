import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import ScrollDemo from "@/components/ScrollDemo";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import LiveDemo from "@/components/LiveDemo";
import WaitlistCTA from "@/components/WaitlistCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <ScrollDemo />
        <HowItWorks />
        <Features />
        <LiveDemo />
        <WaitlistCTA />
      </main>
      <Footer />
    </>
  );
}
