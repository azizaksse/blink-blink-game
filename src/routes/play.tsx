import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Flame, Snowflake, RotateCcw, Home, Trophy } from "lucide-react";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — It Takes Two" },
      { name: "description", content: "A co-op Pac-Man-style maze. Two players, one keyboard, many stages." },
    ],
  }),
  component: PlayPage,
});

// ---------- Pac-Man-style co-op ----------
// Legend in stage strings:
//  # wall   . dot   o power pellet
//  M May spawn   C Cody spawn   G ghost spawn
//  (space) empty corridor

type Cell = { x: number; y: number };
type Dir = { x: number; y: number };

const STAGES: { ghostSpeed: number; map: string[] }[] = [
  { ghostSpeed: 0.65, map: [
    "###############",
    "#M...........C#",
    "#.###.###.###.#",
    "#......G......#",
    "#.###.###.###.#",
    "#.............#",
    "#.###.###.###.#",
    "#......o......#",
    "#.###.###.###.#",
    "#o...........o#",
    "###############",
  ]},
  { ghostSpeed: 0.8, map: [
    "###############",
    "#M.....#.....C#",
    "#.###.#.#.###.#",
    "#.............#",
    "#.#.#######.#.#",
    "#.#....G....#.#",
    "#.#.#######.#.#",
    "#.............#",
    "#.###.#.#.###.#",
    "#o.....#.....o#",
    "###############",
  ]},
  { ghostSpeed: 0.9, map: [
    "###############",
    "#M...........C#",
    "#.##.#####.##.#",
    "#....#...#....#",
    "#.##.#.G.#.##.#",
    "#.##.#####.##.#",
    "#......G......#",
    "#.##.#####.##.#",
    "#.##.#...#.##.#",
    "#o...#.o.#...o#",
    "###############",
  ]},
  { ghostSpeed: 1.0, map: [
    "###############",
    "#M...#...#...C#",
    "#.##.#.#.#.##.#",
    "#.............#",
    "###.#######.###",
    "....#.G.G.#....",
    "###.#######.###",
    "#.............#",
    "#.##.#####.##.#",
    "#o.....o.....o#",
    "###############",
  ]},
  { ghostSpeed: 1.05, map: [
    "###############",
    "#M.....#.....C#",
    "#.###.###.###.#",
    "#.G.........G.#",
    "#.###.###.###.#",
    "#.....#.#.....#",
    "#####.#.#.#####",
    "#.....#.#.....#",
    "#.###.###.###.#",
    "#......G......#",
    "#.###.###.###.#",
    "#o...........o#",
    "###############",
  ]},
  { ghostSpeed: 1.1, map: [
    "###############",
    "#M..#.....#..C#",
    "#.#.#.###.#.#.#",
    "#.#.....G...#.#",
    "#.#.###.###.#.#",
    "#.#...G.G...#.#",
    "#.###.#.#.###.#",
    "#.............#",
    "#.###.#.#.###.#",
    "#.#.........#.#",
    "#.#.#######.#.#",
    "#o..#.....#..o#",
    "###############",
  ]},
  { ghostSpeed: 1.15, map: [
    "###############",
    "#M...........C#",
    "#.###.###.###.#",
    "#.#.G.....G.#.#",
    "#.#.#####.#.#.#",
    "#.....#G#.....#",
    "#.###.#G#.###.#",
    "#.....###.....#",
    "#.#.#######.#.#",
    "#.#.........#.#",
    "#.#.#######.#.#",
    "#o...........o#",
    "###############",
  ]},
  { ghostSpeed: 1.2, map: [
    "###############",
    "#M...#...G...C#",
    "#.##.#.#####.#",
    "#.G..#.......#",
    "#.####.#####.#",
    "#......#.....#",
    "######.###.####",
    "...G..........",
    "######.###.####",
    "#......#.....#",
    "#.####.######.#",
    "#.G..#........#",
    "#.##.#.######.#",
    "#o...#.......o#",
    "###############",
  ]},
  { ghostSpeed: 1.3, map: [
    "###############",
    "#M...........C#",
    "#.#.#######.#.#",
    "#.#.........#.#",
    "#.#.##.#.##.#.#",
    "#.G..#.G.#..G.#",
    "###.#######.###",
    "....#.....#....",
    "###.#.###.#.###",
    "#.G.#.....#.G.#",
    "#.###.###.###.#",
    "#.....#.#.....#",
    "#.###.#.#.###.#",
    "#o...........o#",
    "###############",
  ]},
  { ghostSpeed: 1.6, map: [
    "###############",
    "#M.#.......#.C#",
    "#..#.#####.#..#",
    "#.##.G...G.##.#",
    "#.............#",
    "#.##.#####.##.#",
    "#.G..#GGG#..G.#",
    "#.##.#####.##.#",
    "#.............#",
    "#.##.#####.##.#",
    "#.#..G...G..#.#",
    "#.#.#######.#.#",
    "#..#.......#..#",
    "#o.#.......#.o#",
    "###############",
  ]},
];

// sanitize: ensure each row is exactly the width of row 0 in its stage
for (const s of STAGES) {
  const w = s.map[0].length;
  for (let i = 0; i < s.map.length; i++) {
    if (s.map[i].length < w) s.map[i] = s.map[i] + " ".repeat(w - s.map[i].length);
    else if (s.map[i].length > w) s.map[i] = s.map[i].slice(0, w);
  }
}

const TILE = 24;
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

type Player = {
  name: "May" | "Cody"; color: string; glow: string;
  cell: Cell; next: Cell;        // grid cells (current + interpolating to)
  dir: Dir; queued: Dir | null;
  t: number;                       // 0..1 interpolation
  speed: number;                   // tiles per second
  alive: boolean;
};

type Ghost = {
  color: string; cell: Cell; next: Cell; dir: Dir; t: number; speed: number; home: Cell;
};

type Stage = {
  grid: string[];         // mutable copy (dots get eaten)
  W: number; H: number;
  totalDots: number;
  powerUntil: number;     // performance.now() ms
};

function parseStage(raw: string[]): { stage: Stage; mayStart: Cell; codyStart: Cell; ghostStarts: Cell[] } {
  const grid = raw.map(r => r.split(""));
  let may: Cell = { x: 1, y: 1 }, cody: Cell = { x: 1, y: 1 };
  const ghosts: Cell[] = [];
  let dots = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c === "M") { may = { x, y }; grid[y][x] = "."; dots++; }
      else if (c === "C") { cody = { x, y }; grid[y][x] = "."; dots++; }
      else if (c === "G") { ghosts.push({ x, y }); grid[y][x] = " "; }
      else if (c === ".") dots++;
    }
  }
  return {
    stage: { grid: grid.map(r => r.join("")), W: grid[0].length, H: grid.length, totalDots: dots, powerUntil: 0 },
    mayStart: may, codyStart: cody, ghostStarts: ghosts,
  };
}

function isWall(stage: Stage, x: number, y: number): boolean {
  if (y < 0 || y >= stage.H) return true;
  // horizontal tunnel wrap
  const w = stage.W;
  const xi = ((x % w) + w) % w;
  return stage.grid[y][xi] === "#";
}

function wrapX(stage: Stage, x: number): number {
  const w = stage.W;
  return ((x % w) + w) % w;
}

function eatAt(stage: Stage, x: number, y: number): "dot" | "power" | null {
  const row = stage.grid[y];
  const ch = row[x];
  if (ch === "." || ch === "o") {
    stage.grid[y] = row.substring(0, x) + " " + row.substring(x + 1);
    return ch === "." ? "dot" : "power";
  }
  return null;
}

function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"playing" | "won">("playing");
  const [stageIdx, setStageIdx] = useState(0);
  const [score, setScore] = useState({ dots: 0, total: 0, lives: 3 });

  // refs that the render loop reads — keep latest stage index without resubscribing keys
  const stageIdxRef = useRef(0);
  const advanceRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();

    let parsed = parseStage(STAGES[stageIdxRef.current].map);
    let stage = parsed.stage;
    let ghostSpeedMult = STAGES[stageIdxRef.current].ghostSpeed;
    let dotsEaten = 0;
    let lives = 3;
    let stageDone = false;
    let particles: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];

    canvas.width = stage.W * TILE;
    canvas.height = stage.H * TILE;

    const may: Player = makePlayer("May", parsed.mayStart, "#5aa9ff", "rgba(90,169,255,0.55)");
    const cody: Player = makePlayer("Cody", parsed.codyStart, "#ff5a4d", "rgba(255,90,77,0.55)");
    let ghosts: Ghost[] = parsed.ghostStarts.map((g, i) => makeGhost(g, i));

    setScore({ dots: 0, total: stage.totalDots, lives });

    function makePlayer(name: "May" | "Cody", c: Cell, color: string, glow: string): Player {
      return {
        name, color, glow,
        cell: { ...c }, next: { ...c },
        dir: { x: 0, y: 0 }, queued: null,
        t: 0, speed: 6, alive: true,
      };
    }
    function makeGhost(c: Cell, i: number): Ghost {
      const palette = ["#ff6ab2", "#a78bfa", "#fcd34d", "#5eead4"];
      return {
        color: palette[i % palette.length],
        cell: { ...c }, next: { ...c },
        dir: { x: 0, y: 0 }, t: 0, speed: (3.2 + Math.random() * 0.7) * ghostSpeedMult, home: { ...c },
      };
    }

    function resetPositions() {
      may.cell = { ...parsed.mayStart }; may.next = { ...parsed.mayStart };
      may.dir = { x: 0, y: 0 }; may.queued = null; may.t = 0; may.alive = true;
      cody.cell = { ...parsed.codyStart }; cody.next = { ...parsed.codyStart };
      cody.dir = { x: 0, y: 0 }; cody.queued = null; cody.t = 0; cody.alive = true;
      ghosts.forEach(g => { g.cell = { ...g.home }; g.next = { ...g.home }; g.dir = { x: 0, y: 0 }; g.t = 0; });
    }

    function loadStage(idx: number) {
      stageIdxRef.current = idx;
      setStageIdx(idx);
      parsed = parseStage(STAGES[idx].map);
      stage = parsed.stage;
      ghostSpeedMult = STAGES[idx].ghostSpeed;
      canvas.width = stage.W * TILE;
      canvas.height = stage.H * TILE;
      ghosts = parsed.ghostStarts.map((g, i) => makeGhost(g, i));
      resetPositions();
      dotsEaten = 0;
      stageDone = false;
      setStatus("playing");
      setScore({ dots: 0, total: stage.totalDots, lives });
    }

    advanceRef.current = () => {
      const next = (stageIdxRef.current + 1) % STAGES.length;
      loadStage(next);
    };

    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) e.preventDefault();
      if (k === "w") may.queued = DIRS.up;
      else if (k === "s") may.queued = DIRS.down;
      else if (k === "a") may.queued = DIRS.left;
      else if (k === "d") may.queued = DIRS.right;
      if (e.key === "ArrowUp") cody.queued = DIRS.up;
      else if (e.key === "ArrowDown") cody.queued = DIRS.down;
      else if (e.key === "ArrowLeft") cody.queued = DIRS.left;
      else if (e.key === "ArrowRight") cody.queued = DIRS.right;
      if (k === "r") loadStage(stageIdxRef.current);
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    function stepPlayer(p: Player, dt: number) {
      if (!p.alive) return;
      // If at cell boundary, pick direction
      if (p.t >= 1 || (p.dir.x === 0 && p.dir.y === 0)) {
        p.cell = { ...p.next };
        p.t = 0;
        // try queued
        if (p.queued) {
          const nx = p.cell.x + p.queued.x;
          const ny = p.cell.y + p.queued.y;
          if (!isWall(stage, nx, ny)) { p.dir = p.queued; }
        }
        // continue current
        const cx = p.cell.x + p.dir.x;
        const cy = p.cell.y + p.dir.y;
        if (p.dir.x === 0 && p.dir.y === 0) return;
        if (isWall(stage, cx, cy)) { p.dir = { x: 0, y: 0 }; return; }
        p.next = { x: wrapX(stage, cx), y: cy };
      }
      p.t += dt * p.speed;
      if (p.t > 1) p.t = 1;

      // eat at current cell when crossing midpoint
      if (p.t > 0.5) {
        const eaten = eatAt(stage, p.next.x, p.next.y);
        if (eaten) {
          dotsEaten++;
          if (eaten === "power") stage.powerUntil = performance.now() + 6000;
          burst((p.next.x + 0.5) * TILE, (p.next.y + 0.5) * TILE, "#ffd76a", eaten === "power" ? 16 : 4);
          setScore({ dots: dotsEaten, total: stage.totalDots, lives });
        }
      }
    }

    function stepGhost(g: Ghost, dt: number) {
      if (g.t >= 1 || (g.dir.x === 0 && g.dir.y === 0)) {
        g.cell = { ...g.next };
        g.t = 0;
        // choose direction toward nearest player (or away if powered)
        const target = nearestPlayer(g.cell);
        const opts: Dir[] = [];
        for (const d of [DIRS.up, DIRS.down, DIRS.left, DIRS.right]) {
          if (d.x === -g.dir.x && d.y === -g.dir.y && (g.dir.x || g.dir.y)) continue; // no reverse
          if (!isWall(stage, g.cell.x + d.x, g.cell.y + d.y)) opts.push(d);
        }
        if (opts.length === 0) {
          // allow reverse
          for (const d of [DIRS.up, DIRS.down, DIRS.left, DIRS.right]) {
            if (!isWall(stage, g.cell.x + d.x, g.cell.y + d.y)) opts.push(d);
          }
        }
        const powered = performance.now() < stage.powerUntil;
        let best = opts[0]; let bestScore = powered ? -Infinity : Infinity;
        for (const d of opts) {
          const dx = (g.cell.x + d.x) - target.x;
          const dy = (g.cell.y + d.y) - target.y;
          const dist = dx*dx + dy*dy;
          if (powered ? dist > bestScore : dist < bestScore) { bestScore = dist; best = d; }
        }
        // 20% random for variety
        if (Math.random() < 0.2 && opts.length > 1) best = opts[(Math.random()*opts.length)|0];
        g.dir = best;
        const nx = g.cell.x + g.dir.x, ny = g.cell.y + g.dir.y;
        if (isWall(stage, nx, ny)) { g.dir = { x: 0, y: 0 }; return; }
        g.next = { x: wrapX(stage, nx), y: ny };
      }
      const powered = performance.now() < stage.powerUntil;
      g.t += dt * g.speed * (powered ? 0.6 : 1);
      if (g.t > 1) g.t = 1;
    }

    function nearestPlayer(c: Cell): Cell {
      const dm = (may.cell.x - c.x)**2 + (may.cell.y - c.y)**2;
      const dc = (cody.cell.x - c.x)**2 + (cody.cell.y - c.y)**2;
      if (!may.alive) return cody.cell;
      if (!cody.alive) return may.cell;
      return dm < dc ? may.cell : cody.cell;
    }

    function playerPixel(p: Player) {
      // handle wrap interpolation
      let fx = p.cell.x + (p.next.x - p.cell.x) * p.t;
      let fy = p.cell.y + (p.next.y - p.cell.y) * p.t;
      // detect wrap jump
      if (Math.abs(p.next.x - p.cell.x) > 1) {
        const dir = p.cell.x === 0 ? -1 : 1;
        fx = p.cell.x + dir * p.t;
      }
      return { x: (fx + 0.5) * TILE, y: (fy + 0.5) * TILE };
    }
    function ghostPixel(g: Ghost) {
      let fx = g.cell.x + (g.next.x - g.cell.x) * g.t;
      let fy = g.cell.y + (g.next.y - g.cell.y) * g.t;
      if (Math.abs(g.next.x - g.cell.x) > 1) {
        const dir = g.cell.x === 0 ? -1 : 1;
        fx = g.cell.x + dir * g.t;
      }
      return { x: (fx + 0.5) * TILE, y: (fy + 0.5) * TILE };
    }

    function burst(x: number, y: number, c: string, n: number) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 30 + Math.random() * 20, c,
        });
      }
    }

    let last = performance.now();
    let raf = 0;
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!stageDone) {
        stepPlayer(may, dt);
        stepPlayer(cody, dt);
        for (const g of ghosts) stepGhost(g, dt);

        // collisions
        const powered = performance.now() < stage.powerUntil;
        for (const g of ghosts) {
          for (const p of [may, cody]) {
            if (!p.alive) continue;
            const pp = playerPixel(p), gp = ghostPixel(g);
            if (Math.hypot(pp.x - gp.x, pp.y - gp.y) < TILE * 0.6) {
              if (powered) {
                burst(gp.x, gp.y, g.color, 20);
                g.cell = { ...g.home }; g.next = { ...g.home }; g.dir = { x: 0, y: 0 }; g.t = 0;
              } else {
                lives--;
                burst(pp.x, pp.y, p.glow, 30);
                if (lives <= 0) {
                  setStatus("won"); // game over screen reuses overlay; show as "Caught."
                  stageDone = true;
                  setScore({ dots: dotsEaten, total: stage.totalDots, lives: 0 });
                } else {
                  resetPositions();
                  setScore({ dots: dotsEaten, total: stage.totalDots, lives });
                }
              }
            }
          }
        }

        // stage cleared
        if (!stageDone && dotsEaten >= stage.totalDots) {
          stageDone = true;
          setStatus("won");
        }
      }

      particles = particles.filter(pp => pp.life > 0);
      particles.forEach(pp => { pp.x += pp.vx; pp.y += pp.vy; pp.life--; });

      render();
      raf = requestAnimationFrame(frame);
    }

    function render() {
      const W = canvas.width, H = canvas.height;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0c0a1f"); bg.addColorStop(1, "#1a0d24");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // maze
      for (let y = 0; y < stage.H; y++) {
        for (let x = 0; x < stage.W; x++) {
          const c = stage.grid[y][x];
          const px = x * TILE, py = y * TILE;
          if (c === "#") {
            ctx.fillStyle = "#1e2a6a";
            ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            ctx.strokeStyle = "#4a6aff";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
          } else if (c === ".") {
            ctx.fillStyle = "#ffd76a";
            ctx.beginPath();
            ctx.arc(px + TILE/2, py + TILE/2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (c === "o") {
            ctx.save();
            ctx.shadowColor = "#ffd76a"; ctx.shadowBlur = 14;
            ctx.fillStyle = "#ffd76a";
            ctx.beginPath();
            const r = 6 + Math.sin(performance.now() / 200) * 1.5;
            ctx.arc(px + TILE/2, py + TILE/2, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // particles
      for (const pp of particles) {
        ctx.globalAlpha = Math.min(1, pp.life / 30);
        ctx.fillStyle = pp.c;
        ctx.fillRect(pp.x, pp.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // ghosts
      const powered = performance.now() < stage.powerUntil;
      for (const g of ghosts) {
        const gp = ghostPixel(g);
        drawGhost(ctx, gp.x, gp.y, powered ? "#5aa9ff" : g.color, powered);
      }

      // players
      for (const p of [may, cody]) {
        if (!p.alive) continue;
        const pp = playerPixel(p);
        drawPac(ctx, pp.x, pp.y, p.color, p.glow, p.dir);
      }
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <div className="flex items-center gap-6 text-xs uppercase tracking-[0.25em] text-muted-foreground">
        <span>Stage <span className="text-foreground font-bold">{stageIdx + 1}</span> / {STAGES.length}</span>
        <span>Dots <span className="text-accent font-bold">{score.dots}</span> / {score.total}</span>
        <span>Lives <span className="text-cody font-bold">{"♥".repeat(Math.max(0, score.lives))}</span></span>
      </div>

      <div className="relative w-full max-w-4xl">
        <canvas ref={canvasRef}
          className="w-full h-auto rounded-sm border border-border bg-background block" />
        {status === "won" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-sm">
            <div className="text-center space-y-4">
              <Trophy className="w-12 h-12 mx-auto text-accent animate-pulse-glow" />
              <h2 className="font-display font-black text-5xl text-duo italic">
                {score.lives <= 0 ? "Caught." : "Cleared."}
              </h2>
              <p className="text-muted-foreground">
                {score.dots} / {score.total} dots · Stage {stageIdx + 1}
              </p>
              <div className="flex gap-3 justify-center">
                {score.lives > 0 && stageIdx + 1 < STAGES.length && (
                  <button onClick={() => advanceRef.current()} className="bg-duo text-primary-foreground px-8 py-3 text-xs uppercase tracking-[0.2em] font-bold rounded-sm">
                    Next Stage →
                  </button>
                )}
                <button onClick={() => location.reload()} className="border border-border text-foreground px-8 py-3 text-xs uppercase tracking-[0.2em] font-bold rounded-sm">
                  Restart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-4xl text-xs">
        <ControlCard color="may" name="May" icon={<Snowflake className="w-4 h-4" />}
          keys={[["W A S D", "move through maze"]]} />
        <ControlCard color="cody" name="Cody" icon={<Flame className="w-4 h-4" />}
          keys={[["← ↑ → ↓", "move through maze"]]} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-[0.25em] text-center max-w-xl">
        Eat every dot to clear the stage. Power pellets let you eat ghosts. Press R to restart.
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

function drawPac(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, glow: string, dir: Dir) {
  const r = TILE * 0.42;
  const mouth = (Math.sin(performance.now() / 80) + 1) / 2 * 0.5 + 0.05; // 0.05..0.55
  let angle = 0;
  if (dir.x === 1) angle = 0;
  else if (dir.x === -1) angle = Math.PI;
  else if (dir.y === -1) angle = -Math.PI / 2;
  else if (dir.y === 1) angle = Math.PI / 2;
  ctx.save();
  ctx.shadowColor = glow; ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, angle + mouth, angle - mouth + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scared: boolean) {
  const r = TILE * 0.42;
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 2, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r);
  // wavy bottom
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const x1 = x + r - (2 * r) * ((i + 0.5) / steps);
    const y1 = y + r - 4 + ((i % 2) ? 4 : 0);
    ctx.lineTo(x1, y1);
  }
  ctx.lineTo(x - r, y + r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // eyes
  ctx.fillStyle = "white";
  ctx.beginPath(); ctx.arc(x - 5, y - 2, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 2, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = scared ? "#fff" : "#1a1a2e";
  ctx.beginPath(); ctx.arc(x - 5, y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
}
