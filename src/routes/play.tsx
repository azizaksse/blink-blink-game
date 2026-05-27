import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Flame, Snowflake, RotateCcw, Home, Trophy } from "lucide-react";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — It Takes Two" },
      { name: "description", content: "A tiny co-op platformer. Two players, one keyboard." },
    ],
  }),
  component: PlayPage,
});

// ---------- Game ----------
type Vec = { x: number; y: number };
type Player = {
  pos: Vec; vel: Vec; w: number; h: number;
  color: string; glow: string; name: "May" | "Cody";
  onGround: boolean; jumpsLeft: number; dashCd: number;
  facing: number; coyote: number;
};
type Platform = { x: number; y: number; w: number; h: number; kind?: "may" | "cody" | "normal" };
type Pad = { x: number; y: number; w: number; h: number; owner: "may" | "cody"; pressed: boolean };

const W = 960, H = 540;
const GRAV = 0.65;
const MOVE = 0.7, MAX_VX = 4.2, FRICTION = 0.82;
const JUMP = 11;

const LEVEL: { plats: Platform[]; pads: Pad[]; door: Platform; spawnA: Vec; spawnB: Vec; coins: Vec[] } = {
  plats: [
    { x: 0, y: H - 40, w: W, h: 40 },
    { x: 140, y: 420, w: 120, h: 16 },
    { x: 320, y: 360, w: 100, h: 16, kind: "may" },
    { x: 480, y: 300, w: 120, h: 16 },
    { x: 680, y: 240, w: 110, h: 16, kind: "cody" },
    { x: 280, y: 200, w: 90, h: 16 },
    { x: 60, y: 260, w: 90, h: 16 },
    { x: 820, y: 380, w: 120, h: 16 },
  ],
  pads: [
    { x: 80, y: H - 56, w: 60, h: 16, owner: "may", pressed: false },
    { x: 820, y: H - 56, w: 60, h: 16, owner: "cody", pressed: false },
  ],
  door: { x: 440, y: H - 140, w: 60, h: 100 },
  spawnA: { x: 60, y: H - 100 },
  spawnB: { x: 880, y: H - 100 },
  coins: [
    { x: 200, y: 390 }, { x: 380, y: 330 }, { x: 540, y: 270 },
    { x: 720, y: 210 }, { x: 320, y: 170 }, { x: 100, y: 230 },
  ],
};

function makePlayer(spawn: Vec, name: "May" | "Cody"): Player {
  return {
    pos: { ...spawn }, vel: { x: 0, y: 0 }, w: 26, h: 34,
    color: name === "May" ? "#5aa9ff" : "#ff5a4d",
    glow: name === "May" ? "rgba(90,169,255,0.55)" : "rgba(255,90,77,0.55)",
    name, onGround: false, jumpsLeft: 2, dashCd: 0, facing: 1, coyote: 0,
  };
}

function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"playing" | "won">("playing");
  const [score, setScore] = useState({ coins: 0, time: 0 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();

    const may = makePlayer(LEVEL.spawnA, "May");
    const cody = makePlayer(LEVEL.spawnB, "Cody");
    const pads = LEVEL.pads.map(p => ({ ...p }));
    const coins = LEVEL.coins.map(c => ({ ...c, taken: false }));
    let coinsCollected = 0;
    let won = false;
    let t0 = performance.now();
    let particles: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];

    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
      // jumps fire on keydown
      if (e.key.toLowerCase() === "w") tryJump(may);
      if (e.key === "ArrowUp") tryJump(cody);
      if (e.key.toLowerCase() === "s") tryDash(may);
      if (e.key === "ArrowDown") tryDash(cody);
      if (e.key.toLowerCase() === "r") reset();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    function reset() {
      Object.assign(may, makePlayer(LEVEL.spawnA, "May"));
      Object.assign(cody, makePlayer(LEVEL.spawnB, "Cody"));
      pads.forEach(p => (p.pressed = false));
      coins.forEach(c => (c.taken = false));
      coinsCollected = 0;
      won = false;
      t0 = performance.now();
      setStatus("playing");
      setScore({ coins: 0, time: 0 });
    }

    function tryJump(p: Player) {
      if (won) return;
      if (p.onGround || p.coyote > 0 || p.jumpsLeft > 0) {
        p.vel.y = -JUMP;
        if (!p.onGround && p.coyote <= 0) p.jumpsLeft--;
        p.onGround = false;
        p.coyote = 0;
        burst(p.pos.x + p.w / 2, p.pos.y + p.h, p.glow, 8);
      }
    }
    function tryDash(p: Player) {
      if (won || p.dashCd > 0) return;
      p.vel.x = p.facing * 9.5;
      p.vel.y = -2;
      p.dashCd = 60;
      for (let i = 0; i < 14; i++) burst(p.pos.x + p.w / 2, p.pos.y + p.h / 2, p.glow, 1);
    }

    function burst(x: number, y: number, c: string, n: number) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4 - 1,
          life: 30 + Math.random() * 20, c,
        });
      }
    }

    function physics(p: Player, leftK: string, rightK: string) {
      if (won) { p.vel.x *= 0.8; }
      else {
        if (keys.has(leftK)) { p.vel.x -= MOVE; p.facing = -1; }
        if (keys.has(rightK)) { p.vel.x += MOVE; p.facing = 1; }
        if (!keys.has(leftK) && !keys.has(rightK)) p.vel.x *= FRICTION;
      }
      p.vel.x = Math.max(-MAX_VX * (p.dashCd > 50 ? 2.2 : 1), Math.min(MAX_VX * (p.dashCd > 50 ? 2.2 : 1), p.vel.x));
      p.vel.y += GRAV;
      if (p.vel.y > 16) p.vel.y = 16;

      // X axis
      p.pos.x += p.vel.x;
      for (const pl of LEVEL.plats) if (collide(p, pl)) {
        if (p.vel.x > 0) p.pos.x = pl.x - p.w;
        else if (p.vel.x < 0) p.pos.x = pl.x + pl.w;
        p.vel.x = 0;
      }
      // Y axis
      const wasGround = p.onGround;
      p.onGround = false;
      p.pos.y += p.vel.y;
      for (const pl of LEVEL.plats) {
        if (pl.kind === "may" && p.name !== "May") continue;
        if (pl.kind === "cody" && p.name !== "Cody") continue;
        if (collide(p, pl)) {
          if (p.vel.y > 0) { p.pos.y = pl.y - p.h; p.onGround = true; p.jumpsLeft = p.name === "May" ? 2 : 1; }
          else if (p.vel.y < 0) p.pos.y = pl.y + pl.h;
          p.vel.y = 0;
        }
      }
      if (wasGround && !p.onGround && p.vel.y >= 0) p.coyote = 8;
      else if (p.coyote > 0) p.coyote--;
      if (p.dashCd > 0) p.dashCd--;

      // bounds
      if (p.pos.x < 0) p.pos.x = 0;
      if (p.pos.x + p.w > W) p.pos.x = W - p.w;
      if (p.pos.y > H) { Object.assign(p.pos, p.name === "May" ? LEVEL.spawnA : LEVEL.spawnB); p.vel.x = p.vel.y = 0; }
    }

    function collide(p: Player, r: { x: number; y: number; w: number; h: number }) {
      return p.pos.x < r.x + r.w && p.pos.x + p.w > r.x && p.pos.y < r.y + r.h && p.pos.y + p.h > r.y;
    }
    function overlapRect(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    let raf = 0;
    function frame() {
      physics(may, "a", "d");
      physics(cody, "arrowleft", "arrowright");

      // pads
      pads.forEach(pad => {
        const target = pad.owner === "may" ? may : cody;
        const on =
          target.pos.x + target.w > pad.x &&
          target.pos.x < pad.x + pad.w &&
          Math.abs(target.pos.y + target.h - pad.y) < 4;
        pad.pressed = on;
      });
      const doorOpen = pads.every(p => p.pressed);

      // coins
      for (const c of coins) {
        if (c.taken) continue;
        for (const pl of [may, cody]) {
          if (Math.hypot(c.x - (pl.pos.x + pl.w/2), c.y - (pl.pos.y + pl.h/2)) < 18) {
            c.taken = true; coinsCollected++; burst(c.x, c.y, "#ffd76a", 12);
            setScore(s => ({ ...s, coins: coinsCollected }));
          }
        }
      }

      // win
      if (doorOpen && !won) {
        const inDoorA = overlapRect({x: may.pos.x, y: may.pos.y, w: may.w, h: may.h}, LEVEL.door);
        const inDoorB = overlapRect({x: cody.pos.x, y: cody.pos.y, w: cody.w, h: cody.h}, LEVEL.door);
        if (inDoorA && inDoorB) {
          won = true;
          setStatus("won");
          setScore({ coins: coinsCollected, time: Math.round((performance.now() - t0) / 1000) });
          for (let i = 0; i < 80; i++) burst(LEVEL.door.x + 30, LEVEL.door.y + 50, i % 2 ? may.glow : cody.glow, 1);
        }
      }

      // particles
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--; });

      // ---- render ----
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1a1d3a");
      g.addColorStop(0.6, "#2a1638");
      g.addColorStop(1, "#3a1820");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // distant glow
      const r1 = ctx.createRadialGradient(180, 200, 10, 180, 200, 260);
      r1.addColorStop(0, "rgba(90,169,255,0.35)"); r1.addColorStop(1, "transparent");
      ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
      const r2 = ctx.createRadialGradient(780, 220, 10, 780, 220, 260);
      r2.addColorStop(0, "rgba(255,90,77,0.35)"); r2.addColorStop(1, "transparent");
      ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);

      // platforms
      for (const pl of LEVEL.plats) {
        let col = "#3a2f5a";
        if (pl.kind === "may") col = "rgba(90,169,255,0.55)";
        else if (pl.kind === "cody") col = "rgba(255,90,77,0.55)";
        ctx.fillStyle = col;
        roundRect(ctx, pl.x, pl.y, pl.w, pl.h, 4); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(pl.x, pl.y, pl.w, 2);
      }

      // pads
      for (const pad of pads) {
        ctx.fillStyle = pad.owner === "may" ? "#5aa9ff" : "#ff5a4d";
        ctx.globalAlpha = pad.pressed ? 1 : 0.4;
        roundRect(ctx, pad.x, pad.y + (pad.pressed ? 4 : 0), pad.w, pad.h - (pad.pressed ? 4 : 0), 3); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // door
      const doorGlow = pads.every(p => p.pressed);
      ctx.save();
      if (doorGlow) {
        ctx.shadowColor = "#ffd76a"; ctx.shadowBlur = 40;
      }
      const dg = ctx.createLinearGradient(LEVEL.door.x, LEVEL.door.y, LEVEL.door.x, LEVEL.door.y + LEVEL.door.h);
      dg.addColorStop(0, doorGlow ? "#ffd76a" : "#4a3a6a");
      dg.addColorStop(1, doorGlow ? "#ff8a3a" : "#2a1f3a");
      ctx.fillStyle = dg;
      roundRect(ctx, LEVEL.door.x, LEVEL.door.y, LEVEL.door.w, LEVEL.door.h, 8); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(LEVEL.door.x + 8, LEVEL.door.y + 12, 6, LEVEL.door.h - 24);

      // coins
      for (const c of coins) {
        if (c.taken) continue;
        ctx.save();
        ctx.shadowColor = "#ffd76a"; ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffd76a";
        ctx.beginPath();
        ctx.arc(c.x, c.y + Math.sin((performance.now() + c.x) / 300) * 3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // particles
      for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // players
      drawPlayer(ctx, may);
      drawPlayer(ctx, cody);

      // hud overlay
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px monospace";
      ctx.fillText("MAY: WASD · S = dash", 12, 18);
      ctx.fillText("CODY: ARROWS · ↓ = dash", W - 180, 18);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <div className="flex items-center justify-between w-full max-w-4xl">
        <Link to="/" className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition">
          <Home className="w-4 h-4" /> Home
        </Link>
        <div className="font-display font-black text-xl tracking-widest">
          <span className="text-may">MAY</span> <span className="text-muted-foreground">×</span> <span className="text-cody">CODY</span>
        </div>
        <button onClick={() => location.reload()} className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition">
          <RotateCcw className="w-4 h-4" /> Restart
        </button>
      </div>

      <div className="relative w-full max-w-4xl">
        <canvas ref={canvasRef} width={W} height={H}
          className="w-full h-auto rounded-sm border border-border bg-background block" />
        {status === "won" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-sm">
            <div className="text-center space-y-4">
              <Trophy className="w-12 h-12 mx-auto text-accent animate-pulse-glow" />
              <h2 className="font-display font-black text-5xl text-duo italic">Together.</h2>
              <p className="text-muted-foreground">
                {score.coins} / {LEVEL.coins.length} hearts · {score.time}s
              </p>
              <button onClick={() => location.reload()} className="bg-duo text-primary-foreground px-8 py-3 text-xs uppercase tracking-[0.2em] font-bold rounded-sm">
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-4xl text-xs">
        <ControlCard color="may" name="May" icon={<Snowflake className="w-4 h-4" />}
          keys={[["A / D", "move"], ["W", "double jump"], ["S", "dash"]]} />
        <ControlCard color="cody" name="Cody" icon={<Flame className="w-4 h-4" />}
          keys={[["← / →", "move"], ["↑", "jump"], ["↓", "dash"]]} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-[0.25em] text-center max-w-xl">
        Step on both glowing pads to open the door. Then walk through it — together.
      </p>
    </div>
  );
}

function ControlCard({ color, name, icon, keys }: { color: "may" | "cody"; name: string; icon: React.ReactNode; keys: [string, string][] }) {
  return (
    <div className={`p-4 rounded-sm bg-card/60 backdrop-blur ${color === "may" ? "ring-may" : "ring-cody"}`}>
      <div className={`flex items-center gap-2 mb-3 ${color === "may" ? "text-may" : "text-cody"} font-display font-bold tracking-widest`}>
        {icon} {name.toUpperCase()}
      </div>
      <div className="space-y-1.5">
        {keys.map(([k, v]) => (
          <div key={k} className="flex justify-between text-muted-foreground">
            <kbd className="px-2 py-0.5 bg-background/60 border border-border rounded text-foreground font-mono text-[10px]">{k}</kbd>
            <span className="uppercase tracking-wider text-[10px]">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
  // glow
  ctx.save();
  ctx.shadowColor = p.glow; ctx.shadowBlur = 24;
  ctx.fillStyle = p.color;
  roundRect(ctx, p.pos.x, p.pos.y, p.w, p.h, 6); ctx.fill();
  ctx.restore();
  // face
  ctx.fillStyle = "white";
  const eyeX = p.pos.x + (p.facing > 0 ? 16 : 4);
  ctx.fillRect(p.pos.x + 6, p.pos.y + 10, 4, 4);
  ctx.fillRect(p.pos.x + 16, p.pos.y + 10, 4, 4);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(eyeX, p.pos.y + 11, 2, 3);
  // dash trail
  if (p.dashCd > 50) {
    ctx.fillStyle = p.glow;
    for (let i = 1; i < 5; i++) {
      ctx.globalAlpha = 0.3 - i * 0.05;
      ctx.fillRect(p.pos.x - p.facing * i * 6, p.pos.y, p.w, p.h);
    }
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
