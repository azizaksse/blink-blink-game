import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Sparkles, Swords, Users2, Gamepad2, Play, Flame, Snowflake, ChevronRight } from "lucide-react";
import hero from "@/assets/hero.jpg";
import may from "@/assets/may.jpg";
import cody from "@/assets/cody.jpg";
import level1 from "@/assets/level1.jpg";
import level2 from "@/assets/level2.jpg";
import level3 from "@/assets/level3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "It Takes Two — A Co-op Adventure" },
      { name: "description", content: "Embark on the wildest journey of your life in a fantastical co-op adventure. Two players. One unforgettable bond." },
      { property: "og:title", content: "It Takes Two — A Co-op Adventure" },
      { property: "og:description", content: "A fantastical co-op adventure for two." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Manrope:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Nav />
      <Hero />
      <DuoSection />
      <Levels />
      <Modes />
      <Marquee />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/40">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2 font-display font-black tracking-widest text-sm">
          <span className="w-2 h-2 rounded-full bg-may" />
          <span>IT TAKES TWO</span>
          <span className="w-2 h-2 rounded-full bg-cody" />
        </a>
        <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <a href="#duo" className="hover:text-foreground transition">The Duo</a>
          <a href="#levels" className="hover:text-foreground transition">Worlds</a>
          <a href="#modes" className="hover:text-foreground transition">Modes</a>
          <a href="#play" className="hover:text-foreground transition">Play</a>
        </nav>
        <Link to="/play" className="group relative px-5 py-2.5 bg-duo text-xs uppercase tracking-[0.2em] font-bold text-primary-foreground rounded-sm overflow-hidden">
          <span className="relative z-10 flex items-center gap-2">Play Now <ChevronRight className="w-3 h-3" /></span>
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-end pt-24 pb-16 px-6">
      <img src={hero} alt="May and Cody on a tree branch" width={1920} height={1080}
        className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/20 to-background" />
      <div className="absolute inset-0 vignette" />

      <div className="relative max-w-7xl mx-auto w-full grid md:grid-cols-12 gap-8 items-end">
        <div className="md:col-span-8 space-y-6">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-accent">
            <Sparkles className="w-4 h-4" />
            A Fantastical Co-op Adventure
          </div>
          <h1 className="font-display font-black text-6xl md:text-8xl lg:text-9xl leading-[0.85]">
            <span className="block text-foreground">It Takes</span>
            <span className="block text-duo italic">Two.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
            Embark on the wildest journey of your life. Help a fractured couple rediscover love
            across a world that breaks every rule — together, or not at all.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link to="/play" className="group flex items-center gap-3 bg-duo text-primary-foreground px-8 py-4 font-bold uppercase tracking-[0.15em] text-sm rounded-sm">
              <Play className="w-4 h-4 fill-current" /> Begin the Journey
            </Link>
            <button className="flex items-center gap-3 border border-border/80 bg-background/40 backdrop-blur px-8 py-4 font-bold uppercase tracking-[0.15em] text-sm rounded-sm hover:bg-card transition">
              Watch Trailer
            </button>
          </div>
        </div>

        <div className="md:col-span-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Players" value="2" tone="may" />
          <Stat label="Worlds" value="7+" tone="cody" />
          <Stat label="Awards" value="GOTY" tone="cody" />
          <Stat label="Friend Pass" value="Free" tone="may" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "may" | "cody" }) {
  return (
    <div className={`p-5 rounded-sm backdrop-blur-md bg-card/40 ${tone === "may" ? "ring-may" : "ring-cody"}`}>
      <div className="font-display text-3xl font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function DuoSection() {
  return (
    <section id="duo" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionLabel icon={<Users2 className="w-4 h-4" />} text="Meet the Duo" />
        <h2 className="font-display font-black text-5xl md:text-7xl mt-6 max-w-3xl">
          Two halves of a <span className="text-duo italic">broken whole.</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mt-16">
          <CharacterCard
            name="May"
            tagline="The Engineer"
            color="may"
            image={may}
            icon={<Snowflake className="w-5 h-5" />}
            traits={["Precision", "Logic", "Patience"]}
            quote="“Measure twice. Leap once.”"
          />
          <CharacterCard
            name="Cody"
            tagline="The Dreamer"
            color="cody"
            image={cody}
            icon={<Flame className="w-5 h-5" />}
            traits={["Instinct", "Heart", "Recklessness"]}
            quote="“What's the worst that could happen?”"
          />
        </div>
      </div>
    </section>
  );
}

function CharacterCard({ name, tagline, color, image, icon, traits, quote }: {
  name: string; tagline: string; color: "may" | "cody"; image: string;
  icon: React.ReactNode; traits: string[]; quote: string;
}) {
  const isMay = color === "may";
  return (
    <article className={`group relative overflow-hidden rounded-sm bg-card/60 backdrop-blur ${isMay ? "ring-may" : "ring-cody"}`}>
      <div className="grid grid-cols-5">
        <div className="col-span-2 relative aspect-[3/4] overflow-hidden">
          <img src={image} alt={name} loading="lazy" width={768} height={1024}
            className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-105" />
          <div className={`absolute inset-0 ${isMay ? "bg-gradient-to-tr from-may/40 to-transparent" : "bg-gradient-to-tr from-cody/40 to-transparent"}`} />
        </div>
        <div className="col-span-3 p-8 flex flex-col justify-between gap-6">
          <div>
            <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.3em] ${isMay ? "text-may" : "text-cody"}`}>
              {icon} {tagline}
            </div>
            <h3 className="font-display font-black text-5xl mt-3">{name}</h3>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed italic">{quote}</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Traits</div>
            <div className="flex flex-wrap gap-2">
              {traits.map(t => (
                <span key={t} className={`px-3 py-1.5 text-xs uppercase tracking-wider border rounded-sm ${isMay ? "border-may/40 text-may" : "border-cody/40 text-cody"}`}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Levels() {
  const levels = [
    { img: level1, n: "I", title: "The Clock Tower", desc: "Time bends. Mechanisms creak. Only synchronized minds advance." },
    { img: level2, n: "II", title: "The Snow Globe", desc: "A frozen kingdom in glass. Ice magic meets toy soldiers." },
    { img: level3, n: "III", title: "The Garden", desc: "Become small. The lawn becomes a continent of wonder and beasts." },
  ];
  return (
    <section id="levels" className="relative py-32 px-6 border-y border-border/40">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <SectionLabel icon={<Sparkles className="w-4 h-4" />} text="Worlds to Explore" />
            <h2 className="font-display font-black text-5xl md:text-7xl mt-6 max-w-2xl">
              Every chapter, a <span className="text-duo italic">new universe.</span>
            </h2>
          </div>
          <p className="max-w-sm text-muted-foreground">
            Hand-crafted levels that reinvent themselves every hour. No two mechanics ever repeat.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-16">
          {levels.map((l, i) => (
            <article key={l.title} className="group relative aspect-[3/4] overflow-hidden rounded-sm bg-card">
              <img src={l.img} alt={l.title} loading="lazy" width={1024} height={768}
                className="absolute inset-0 w-full h-full object-cover transition duration-1000 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute top-6 left-6 font-display font-black text-7xl text-foreground/90 leading-none">{l.n}</div>
              <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.3em] text-accent">Chapter 0{i + 1}</div>
                <h3 className="font-display font-bold text-2xl">{l.title}</h3>
                <p className="text-sm text-muted-foreground">{l.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modes() {
  const modes = [
    { icon: <Users2 />, title: "Local Co-op", desc: "Split-screen on one couch. The way it was meant to be played." },
    { icon: <Gamepad2 />, title: "Online Pass", desc: "Invite a friend free. One copy unlocks two journeys." },
    { icon: <Swords />, title: "Mini-Games", desc: "Over 25 hidden duels scattered across every chapter." },
    { icon: <Heart />, title: "Shared Story", desc: "Cinematic moments require both controllers. Always." },
  ];
  return (
    <section id="modes" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionLabel icon={<Gamepad2 className="w-4 h-4" />} text="How You Play" />
        <h2 className="font-display font-black text-5xl md:text-7xl mt-6 max-w-3xl">
          Built for <span className="text-duo italic">two,</span> from frame one.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-16">
          {modes.map((m, i) => (
            <div key={m.title} className="group relative p-8 rounded-sm bg-card/60 backdrop-blur border border-border hover:border-accent transition">
              <div className={`mb-6 inline-flex p-3 rounded-sm ${i % 2 === 0 ? "bg-may/15 text-may" : "bg-cody/15 text-cody"}`}>
                {m.icon}
              </div>
              <h3 className="font-display font-bold text-2xl mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ["GAME OF THE YEAR", "10/10 IGN", "BEST CO-OP", "BAFTA WINNER", "GOLDEN JOYSTICK", "TGA 2021", "PLAYER'S CHOICE"];
  return (
    <section className="relative py-12 border-y border-border/40 bg-card/30 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...items, ...items, ...items].map((it, i) => (
          <span key={i} className="px-12 font-display font-black text-3xl tracking-[0.15em] text-muted-foreground/70 inline-flex items-center gap-12">
            {it} <span className="w-2 h-2 rounded-full bg-duo" />
          </span>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="play" className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto text-center space-y-8">
        <div className="flex justify-center items-center gap-4">
          <span className="h-px w-16 bg-may" />
          <Heart className="w-6 h-6 text-accent animate-pulse-glow" />
          <span className="h-px w-16 bg-cody" />
        </div>
        <h2 className="font-display font-black text-5xl md:text-8xl leading-[0.9]">
          Grab a friend.<br />
          <span className="text-duo italic">Save the love.</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-lg">
          One copy. Two players. Endless invention. Cross-platform Friend Pass included.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-6">
          <Link to="/play" className="bg-duo text-primary-foreground px-10 py-5 font-bold uppercase tracking-[0.15em] text-sm rounded-sm">
            Start Adventure
          </Link>
          <button className="border border-border bg-card/40 backdrop-blur px-10 py-5 font-bold uppercase tracking-[0.15em] text-sm rounded-sm hover:bg-card transition">
            Send Friend Pass
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40 py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <div className="flex items-center gap-2 font-display font-black">
          <span className="w-2 h-2 rounded-full bg-may" />
          IT TAKES TWO
          <span className="w-2 h-2 rounded-full bg-cody" />
        </div>
        <div>A fan-made UI tribute · For demonstration only</div>
      </div>
    </footer>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-accent">
      {icon} {text}
    </div>
  );
}
