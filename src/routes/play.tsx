import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Flame, Snowflake, RotateCcw, Home, Trophy, Users, ShieldAlert, Cpu, Wifi, Key, Send, Clock, Award, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — It Takes Two Multiplayer" },
      { name: "description", content: "Play It Takes Two Pac-Man online with chats, leaderboards, and character skills!" },
    ],
  }),
  component: PlayPage,
});

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
];

// Sanitize maps
for (const s of STAGES) {
  const w = s.map[0].length;
  for (let i = 0; i < s.map.length; i++) {
    if (s.map[i].length < w) s.map[i] = s.map[i] + " ".repeat(w - s.map[i].length);
    else if (s.map[i].length > w) s.map[i] = s.map[i].slice(0, w);
  }
}

const TILE = 32;
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

type Player = {
  name: "May" | "Cody"; color: string; glow: string;
  cell: Cell; next: Cell;
  dir: Dir; queued: Dir | null;
  t: number;
  speed: number;
  alive: boolean;
};

type Ghost = {
  color: string; cell: Cell; next: Cell; dir: Dir; t: number; speed: number; home: Cell;
};

type Stage = {
  grid: string[];
  W: number; H: number;
  totalDots: number;
  powerUntil: number;
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

// Local mock records if Convex offline
type LocalRecord = { stageIdx: number; scoreSeconds: number; date: string };

function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Setup lobby parameters
  const [playMode, setPlayMode] = useState<"local" | "online" | null>(null);
  const [role, setRole] = useState<"may" | "cody" | null>(null);
  const [roomCode, setRoomCode] = useState<string>("");
  const [roomInput, setRoomInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Game UI counters
  const [status, setStatus] = useState<"playing" | "won" | "waiting" | "lost">("playing");
  const [stageIdx, setStageIdx] = useState(0);
  const [score, setScore] = useState({ dots: 0, total: 0, lives: 3 });

  // Cooldown meters & chat states
  const [chatMessage, setChatMessage] = useState("");
  const [localChats, setLocalChats] = useState<{ sender: string; text: string; time: number }[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [localLeaderboard, setLocalLeaderboard] = useState<LocalRecord[]>([]);

  // Cooldown timestamps
  const [maySkillCooldown, setMaySkillCooldown] = useState(0); // timestamp (ms)
  const [codySkillCooldown, setCodySkillCooldown] = useState(0); // timestamp (ms)

  // Skill active indicators
  const [ghostsFrozen, setGhostsFrozen] = useState(false);
  const [codyDashing, setCodyDashing] = useState(false);

  // Mobile active tab state
  const [mobileActiveTab, setMobileActiveTab] = useState<"chat" | "leaderboard" | "hidden">("hidden");

  // D-Pad touch controls reference
  const touchMoveRef = useRef<(player: "may" | "cody", d: "up" | "down" | "left" | "right") => void>(() => {});
  const touchMove = (player: "may" | "cody", d: "up" | "down" | "left" | "right") => {
    touchMoveRef.current(player, d);
  };

  // Refs for loop read/write
  const roleRef = useRef<"may" | "cody" | null>(null);
  roleRef.current = role;

  const roomCodeRef = useRef<string>("");
  roomCodeRef.current = roomCode;

  const advanceRef = useRef<() => void>(() => {});
  const triggerRestartRef = useRef<() => void>(() => {});
  const triggerSkillRef = useRef<() => void>(() => {});

  // Convex Hooks
  const createRoomMut = useMutation(api.rooms.createRoom);
  const joinRoomMut = useMutation(api.rooms.joinRoom);
  const updatePlayerMut = useMutation(api.rooms.updatePlayer);
  const updateGhostsMut = useMutation(api.rooms.updateGhosts);
  const eatDotMut = useMutation(api.rooms.eatDot);
  const playerDeathMut = useMutation(api.rooms.playerDeath);
  const resetRoomMut = useMutation(api.rooms.resetRoom);
  const advanceStageMut = useMutation(api.rooms.advanceStage);
  
  // Real-time Chat, Abilities and Leaderboard mutations
  const sendChatMessageMut = useMutation(api.rooms.sendChatMessage);
  const useAbilityMut = useMutation(api.rooms.useAbility);
  const recordStageClearMut = useMutation(api.rooms.recordStageClear);

  // Synced Convex States
  const convexRoomData = useQuery(
    api.rooms.getRoom,
    roomCode ? { roomCode } : "skip"
  );
  
  const convexLeaderboard = useQuery(
    api.rooms.getLeaderboard,
    playMode === "online" ? { stageIdx } : "skip"
  );

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Environment checks
  const isConvexConfigured = !import.meta.env.VITE_CONVEX_URL?.includes("dummy") && 
                             !import.meta.env.VITE_CONVEX_URL?.includes("undefined");

  // Load local leaderboards from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("blink_blink_leaderboard");
    if (raw) {
      setLocalLeaderboard(JSON.parse(raw));
    }
  }, []);

  // Save stage clear record locally (fallback)
  const saveLocalRecord = (idx: number, seconds: number) => {
    const newRecord: LocalRecord = {
      stageIdx: idx,
      scoreSeconds: seconds,
      date: new Date().toLocaleTimeString()
    };
    const updated = [...localLeaderboard, newRecord].sort((a, b) => a.scoreSeconds - b.scoreSeconds);
    setLocalLeaderboard(updated);
    localStorage.setItem("blink_blink_leaderboard", JSON.stringify(updated));
  };

  // Create lobby room
  const handleCreateRoom = async () => {
    try {
      setErrorMessage("");
      if (isConvexConfigured) {
        const res = await createRoomMut();
        setRoomCode(res.roomCode);
        setRole("may");
        setStatus("waiting");
      } else {
        const mockCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        setRoomCode(mockCode);
        setRole("may");
        setStatus("waiting");
      }
    } catch (err: any) {
      const mockCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      setRoomCode(mockCode);
      setRole("may");
      setStatus("waiting");
    }
  };

  // Join lobby room
  const handleJoinRoom = async () => {
    if (!roomInput.trim()) return;
    try {
      setErrorMessage("");
      const upperCode = roomInput.trim().toUpperCase();
      if (isConvexConfigured) {
        const room = await joinRoomMut({ roomCode: upperCode, role: "cody" });
        if (room) {
          setRoomCode(upperCode);
          setRole("cody");
          setStatus("playing");
        }
      } else {
        setRoomCode(upperCode);
        setRole("cody");
        setStatus("playing");
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "peerJoined", role: "cody" });
        }
      }
    } catch (err: any) {
      setRoomCode(roomInput.trim().toUpperCase());
      setRole("cody");
      setStatus("playing");
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: "peerJoined", role: "cody" });
      }
    }
  };

  // Skill use activation
  const handleUseSkill = () => {
    if (role === "may") {
      if (Date.now() < maySkillCooldown) return; // Cooldown active
      setMaySkillCooldown(Date.now() + 12000); // 12 seconds cooldown
      setGhostsFrozen(true);
      setTimeout(() => setGhostsFrozen(false), 4000); // 4 seconds freeze

      // Sync skill triggers
      if (playMode === "online") {
        if (isConvexConfigured) {
          useAbilityMut({ roomCode, role: "may" });
        }
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "useSkill", role: "may" });
        }
      } else {
        // Local feedback message
        setLocalChats(prev => [...prev, {
          sender: "May", text: "❄️ TIME FREEZE! Ghosts frozen for 4s!", time: Date.now()
        }]);
      }
    } else if (role === "cody") {
      if (Date.now() < codySkillCooldown) return;
      setCodySkillCooldown(Date.now() + 12000);
      setCodyDashing(true);
      setTimeout(() => setCodyDashing(false), 3000); // 3 seconds speed dash

      if (playMode === "online") {
        if (isConvexConfigured) {
          useAbilityMut({ roomCode, role: "cody" });
        }
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "useSkill", role: "cody" });
        }
      } else {
        setLocalChats(prev => [...prev, {
          sender: "Cody", text: "🔥 BLAZE DASH! Cody double speed for 3s!", time: Date.now()
        }]);
      }
    }
  };
  triggerSkillRef.current = handleUseSkill;

  // Sending Chat message
  const handleSendMessage = (textToSend?: string) => {
    const msg = textToSend || chatMessage;
    if (!msg.trim()) return;

    const senderName = role === "may" ? "May" : role === "cody" ? "Cody" : "Local Player";
    
    if (playMode === "online") {
      if (isConvexConfigured) {
        sendChatMessageMut({ roomCode, sender: senderName, text: msg.trim() });
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "chatMessage",
          sender: senderName,
          text: msg.trim(),
          time: Date.now()
        });
      }
    }
    
    // Always add message locally
    setLocalChats(prev => [...prev, { sender: senderName, text: msg.trim(), time: Date.now() }]);
    if (!textToSend) setChatMessage("");
  };

  // Setup broadcast listeners
  useEffect(() => {
    if (!roomCode) return;
    const channel = new BroadcastChannel(`blink-blink-${roomCode}`);
    broadcastChannelRef.current = channel;

    channel.onmessage = (e) => {
      const data = e.data;
      if (data.type === "peerJoined" && role === "may") {
        setStatus("playing");
        setStartTime(Date.now());
        channel.postMessage({ type: "startGame" });
      }
      if (data.type === "startGame") {
        setStatus("playing");
        setStartTime(Date.now());
      }
      if (data.type === "chatMessage") {
        setLocalChats(prev => [...prev, { sender: data.sender, text: data.text, time: data.time }]);
      }
      if (data.type === "useSkill") {
        if (data.role === "may") {
          setGhostsFrozen(true);
          setTimeout(() => setGhostsFrozen(false), 4000);
          setLocalChats(prev => [...prev, {
            sender: "May", text: "❄️ TIME FREEZE! Ghosts frozen for 4s!", time: Date.now()
          }]);
        } else if (data.role === "cody") {
          setCodyDashing(true);
          setTimeout(() => setCodyDashing(false), 3000);
          setLocalChats(prev => [...prev, {
            sender: "Cody", text: "🔥 BLAZE DASH! Cody double speed for 3s!", time: Date.now()
          }]);
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [roomCode, role]);

  // Sync timers & chats from Convex
  useEffect(() => {
    if (playMode !== "online" || !roomCode) return;

    if (convexRoomData) {
      // Sync chat list
      if (convexRoomData.chat && convexRoomData.chat.length > localChats.length) {
        setLocalChats(convexRoomData.chat);
      }
      // Sync May ability
      if (convexRoomData.ghostsFrozenUntil > Date.now()) {
        setGhostsFrozen(true);
      } else {
        setGhostsFrozen(false);
      }
      // Sync Cody ability
      if (convexRoomData.codyDashActiveUntil > Date.now()) {
        setCodyDashing(true);
      } else {
        setCodyDashing(false);
      }
      // Sync timer start
      if (convexRoomData.stageStartTime !== startTime) {
        setStartTime(convexRoomData.stageStartTime);
      }
    }
  }, [convexRoomData, playMode, roomCode]);

  // Sync Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localChats]);

  // Local game clock
  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      setTimerSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, status]);

  // Start local mode timer
  useEffect(() => {
    if (playMode === "local") {
      setStartTime(Date.now());
      setLocalChats([
        { sender: "System", text: "Co-op bounds loaded. Control both players on this screen!", time: Date.now() }
      ]);
    }
  }, [playMode]);

  // Core Game Loop
  useEffect(() => {
    if (playMode === null) return;
    if (playMode === "online" && (!role || status === "waiting")) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();

    let parsed = parseStage(STAGES[stageIdx].map);
    let stage = parsed.stage;
    let ghostSpeedMult = STAGES[stageIdx].ghostSpeed;
    let dotsEaten = 0;
    let lives = 3;
    let stageDone = false;
    let particles: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];

    // Screen adjustments: keep resolution fixed to the stage grid coordinates
    canvas.width = stage.W * TILE;
    canvas.height = stage.H * TILE;

    // Bind D-pad touch movement controls inside the loop
    touchMoveRef.current = (player, d) => {
      const p = player === "may" ? may : cody;
      p.queued = DIRS[d];
    };

    const may: Player = makePlayer("May", parsed.mayStart, "#5aa9ff", "rgba(90,169,255,0.6)");
    const cody: Player = makePlayer("Cody", parsed.codyStart, "#ff5a4d", "rgba(255,90,77,0.6)");
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
      parsed = parseStage(STAGES[idx].map);
      stage = parsed.stage;
      
      // Update canvas resolution dynamically for each stage!
      canvas.width = stage.W * TILE;
      canvas.height = stage.H * TILE;

      ghostSpeedMult = STAGES[idx].ghostSpeed;
      ghosts = parsed.ghostStarts.map((g, i) => makeGhost(g, i));
      resetPositions();
      dotsEaten = 0;
      stageDone = false;
      setStatus("playing");
      setStartTime(Date.now());
      setScore({ dots: 0, total: stage.totalDots, lives });
    }

    advanceRef.current = () => {
      const next = (stageIdx + 1) % STAGES.length;
      if (playMode === "online") {
        if (isConvexConfigured) {
          advanceStageMut({ roomCode });
        }
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "advanceStage", idx: next });
        }
      }
      loadStage(next);
      setStageIdx(next);
    };

    triggerRestartRef.current = () => {
      if (playMode === "online") {
        if (isConvexConfigured) {
          resetRoomMut({ roomCode });
        }
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: "restartRoom" });
        }
      }
      loadStage(stageIdx);
    };

    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (["arrowup","arrowdown","arrowleft","arrowright"," ", "spacebar"].includes(k)) e.preventDefault();

      const activePlayerRole = roleRef.current;

      // Spacebar activates special ability!
      if (e.key === " " || e.key === "Spacebar") {
        triggerSkillRef.current();
        return;
      }

      if (playMode === "local" || activePlayerRole === "may") {
        if (k === "w") may.queued = DIRS.up;
        else if (k === "s") may.queued = DIRS.down;
        else if (k === "a") may.queued = DIRS.left;
        else if (k === "d") may.queued = DIRS.right;
      }
      
      if (playMode === "local" || activePlayerRole === "cody") {
        if (e.key === "ArrowUp") cody.queued = DIRS.up;
        else if (e.key === "ArrowDown") cody.queued = DIRS.down;
        else if (e.key === "ArrowLeft") cody.queued = DIRS.left;
        else if (e.key === "ArrowRight") cody.queued = DIRS.right;
      }

      if (k === "r") triggerRestartRef.current();
    };

    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    // Sync broadcast listeners inside loop
    if (playMode === "online" && broadcastChannelRef.current) {
      broadcastChannelRef.current.onmessage = (e) => {
        const data = e.data;
        if (data.type === "playerUpdate") {
          const peer = data.role === "may" ? may : cody;
          peer.cell = data.cell;
          peer.next = data.next;
          peer.dir = data.dir;
          peer.t = data.t;
          peer.alive = data.alive;
        }
        if (data.type === "ghostsUpdate" && role === "cody") {
          data.ghosts.forEach((dg: any, idx: number) => {
            if (ghosts[idx]) {
              ghosts[idx].cell = dg.cell;
              ghosts[idx].next = dg.next;
              ghosts[idx].dir = dg.dir;
              ghosts[idx].t = dg.t;
            }
          });
        }
        if (data.type === "eatDot") {
          const eaten = eatAt(stage, data.x, data.y);
          if (eaten) {
            dotsEaten++;
            if (eaten === "power") stage.powerUntil = performance.now() + 6000;
            const peer = data.role === "may" ? may : cody;
            const pp = playerPixel(peer);
            burst(pp.x, pp.y, "#ffd76a", eaten === "power" ? 16 : 4);
            setScore({ dots: dotsEaten, total: stage.totalDots, lives });
          }
        }
        if (data.type === "playerDeath") {
          lives = data.lives;
          resetPositions();
          setScore({ dots: dotsEaten, total: stage.totalDots, lives });
          if (lives <= 0) {
            setStatus("lost");
            stageDone = true;
          }
        }
        if (data.type === "advanceStage") {
          loadStage(data.idx);
          setStageIdx(data.idx);
        }
        if (data.type === "restartRoom") {
          loadStage(stageIdx);
        }
        if (data.type === "chatMessage") {
          setLocalChats(prev => [...prev, { sender: data.sender, text: data.text, time: data.time }]);
        }
        if (data.type === "useSkill") {
          if (data.role === "may") {
            setGhostsFrozen(true);
            setTimeout(() => setGhostsFrozen(false), 4000);
            setLocalChats(prev => [...prev, {
              sender: "May", text: "❄️ TIME FREEZE! Ghosts frozen for 4s!", time: Date.now()
            }]);
          } else if (data.role === "cody") {
            setCodyDashing(true);
            setTimeout(() => setCodyDashing(false), 3000);
            setLocalChats(prev => [...prev, {
              sender: "Cody", text: "🔥 BLAZE DASH! Cody double speed for 3s!", time: Date.now()
            }]);
          }
        }
      };
    }

    // Step player coordinates
    function stepPlayer(p: Player, dt: number) {
      if (!p.alive) return;
      
      // Dynamic ability speed calculations: Cody doubles speed during Blaze Dash!
      const currentSpeed = p.name === "Cody" && codyDashing ? 12 : 6;
      p.speed = currentSpeed;

      if (p.t >= 1 || (p.dir.x === 0 && p.dir.y === 0)) {
        p.cell = { ...p.next };
        p.t = 0;
        
        if (p.queued) {
          const nx = p.cell.x + p.queued.x;
          const ny = p.cell.y + p.queued.y;
          if (!isWall(stage, nx, ny)) { p.dir = p.queued; }
        }
        const cx = p.cell.x + p.dir.x;
        const cy = p.cell.y + p.dir.y;
        if (p.dir.x === 0 && p.dir.y === 0) return;
        if (isWall(stage, cx, cy)) { p.dir = { x: 0, y: 0 }; return; }
        p.next = { x: wrapX(stage, cx), y: cy };

        if (playMode === "online" && role === p.name.toLowerCase()) {
          if (isConvexConfigured) {
            updatePlayerMut({
              roomCode,
              role,
              x: p.cell.x, y: p.cell.y,
              nextX: p.next.x, nextY: p.next.y,
              dirX: p.dir.x, dirY: p.dir.y,
              t: p.t,
              alive: p.alive,
            });
          }
          if (broadcastChannelRef.current) {
            broadcastChannelRef.current.postMessage({
              type: "playerUpdate",
              role: role,
              cell: p.cell,
              next: p.next,
              dir: p.dir,
              t: p.t,
              alive: p.alive,
            });
          }
        }
      }
      p.t += dt * p.speed;
      if (p.t > 1) p.t = 1;

      // Blaze dash particle trails behind Cody
      if (p.name === "Cody" && codyDashing && Math.random() < 0.4) {
        const pp = playerPixel(p);
        burst(pp.x, pp.y, "rgba(255, 90, 77, 0.7)", 2);
      }

      // Eat dot
      if (p.t > 0.5) {
        const eaten = eatAt(stage, p.next.x, p.next.y);
        if (eaten) {
          dotsEaten++;
          if (eaten === "power") stage.powerUntil = performance.now() + 6000;
          burst((p.next.x + 0.5) * TILE, (p.next.y + 0.5) * TILE, "#ffd76a", eaten === "power" ? 16 : 4);
          setScore({ dots: dotsEaten, total: stage.totalDots, lives });

          if (playMode === "online" && role === p.name.toLowerCase()) {
            if (isConvexConfigured) {
              eatDotMut({ roomCode, x: p.next.x, y: p.next.y, dotType: eaten });
            }
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.postMessage({
                type: "eatDot",
                role: role,
                x: p.next.x,
                y: p.next.y,
                dotType: eaten,
              });
            }
          }
        }
      }
    }

    // Step Ghosts
    function stepGhost(g: Ghost, dt: number) {
      // Freeze Snowflake logic: if frozen, ghosts do not step!
      if (ghostsFrozen) return;

      if (g.t >= 1 || (g.dir.x === 0 && g.dir.y === 0)) {
        g.cell = { ...g.next };
        g.t = 0;
        const target = nearestPlayer(g.cell);
        const opts: Dir[] = [];
        for (const d of [DIRS.up, DIRS.down, DIRS.left, DIRS.right]) {
          if (d.x === -g.dir.x && d.y === -g.dir.y && (g.dir.x || g.dir.y)) continue;
          if (!isWall(stage, g.cell.x + d.x, g.cell.y + d.y)) opts.push(d);
        }
        if (opts.length === 0) {
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
      let fx = p.cell.x + (p.next.x - p.cell.x) * p.t;
      let fy = p.cell.y + (p.next.y - p.cell.y) * p.t;
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

      // Convex Real-Time Query Sync
      if (playMode === "online" && convexRoomData) {
        if (role !== "may") {
          may.cell = { x: convexRoomData.may.x, y: convexRoomData.may.y };
          may.next = { x: convexRoomData.may.nextX, y: convexRoomData.may.nextY };
          may.dir = { x: convexRoomData.may.dirX, y: convexRoomData.may.dirY };
          may.t = convexRoomData.may.t;
          may.alive = convexRoomData.may.alive;
        }
        if (role !== "cody") {
          cody.cell = { x: convexRoomData.cody.x, y: convexRoomData.cody.y };
          cody.next = { x: convexRoomData.cody.nextX, y: convexRoomData.cody.nextY };
          cody.dir = { x: convexRoomData.cody.dirX, y: convexRoomData.cody.dirY };
          cody.t = convexRoomData.cody.t;
          cody.alive = convexRoomData.cody.alive;
        }
        if (role !== "may") {
          convexRoomData.ghosts.forEach((cg: any, idx: number) => {
            if (ghosts[idx]) {
              ghosts[idx].cell = { x: cg.x, y: cg.y };
              ghosts[idx].next = { x: cg.nextX, y: cg.nextY };
              ghosts[idx].dir = { x: cg.dirX, y: cg.dirY };
              ghosts[idx].t = cg.t;
            }
          });
        }
        convexRoomData.eatenDots.forEach((key: string) => {
          const [dx, dy] = key.split(",").map(Number);
          eatAt(stage, dx, dy);
        });
      }

      if (!stageDone) {
        if (playMode === "local" || role === "may") stepPlayer(may, dt);
        if (playMode === "local" || role === "cody") stepPlayer(cody, dt);

        if (playMode === "local" || role === "may") {
          for (const g of ghosts) stepGhost(g, dt);

          if (playMode === "online") {
            if (isConvexConfigured) {
              updateGhostsMut({
                roomCode,
                ghosts: ghosts.map(g => ({
                  x: g.cell.x, y: g.cell.y,
                  nextX: g.next.x, nextY: g.next.y,
                  dirX: g.dir.x, dirY: g.dir.y,
                  t: g.t, color: g.color,
                })),
              });
            }
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.postMessage({
                type: "ghostsUpdate",
                ghosts: ghosts.map(g => ({
                  cell: g.cell, next: g.next,
                  dir: g.dir, t: g.t, color: g.color
                }))
              });
            }
          }
        }

        // Damage Collision
        const powered = playMode === "online" && convexRoomData 
          ? Date.now() < convexRoomData.powerUntil 
          : performance.now() < stage.powerUntil;

        for (const g of ghosts) {
          for (const p of [may, cody]) {
            if (!p.alive) continue;
            if (playMode === "online" && role !== p.name.toLowerCase()) continue;

            const pp = playerPixel(p), gp = ghostPixel(g);
            if (Math.hypot(pp.x - gp.x, pp.y - gp.y) < TILE * 0.6) {
              if (powered) {
                burst(gp.x, gp.y, g.color, 20);
                g.cell = { ...g.home }; g.next = { ...g.home }; g.dir = { x: 0, y: 0 }; g.t = 0;
              } else {
                // If May's Snowflake Time Freeze is active, ghosts are frozen and cannot damage!
                if (ghostsFrozen) continue;

                lives--;
                burst(pp.x, pp.y, p.glow, 30);
                
                if (playMode === "online") {
                  if (isConvexConfigured) {
                    playerDeathMut({ roomCode });
                  }
                  if (broadcastChannelRef.current) {
                    broadcastChannelRef.current.postMessage({
                      type: "playerDeath",
                      lives: lives,
                    });
                  }
                }
                
                if (lives <= 0) {
                  setStatus("lost");
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

        // Stage Clearance
        const totalActiveEaten = playMode === "online" && convexRoomData
          ? convexRoomData.eatenDots.length
          : dotsEaten;

        if (!stageDone && totalActiveEaten >= stage.totalDots) {
          stageDone = true;
          setStatus("won");
          const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          
          if (playMode === "online") {
            if (isConvexConfigured) {
              recordStageClearMut({ roomCode });
            }
          } else {
            saveLocalRecord(stageIdx, durationSeconds);
          }
        }
      }

      particles = particles.filter(pp => pp.life > 0);
      particles.forEach(pp => { pp.x += pp.vx; pp.y += pp.vy; pp.life--; });

      render();
      raf = requestAnimationFrame(frame);
    }

    function render() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Draw fixed parallax gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#080616"); bg.addColorStop(1, "#120a1a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Static parallax stars
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
      }
      for (let j = 0; j < H; j += 40) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke();
      }

      // Translate Camera View focused on player
      ctx.save();
      const isOnline = playMode === "online";
      const activePlayer = role === "cody" ? cody : may;

      if (isOnline && (W < stage.W * TILE || H < stage.H * TILE)) {
        const pp = playerPixel(activePlayer);
        const camX = pp.x - W / 2;
        const camY = pp.y - H / 2;
        ctx.translate(-camX, -camY);
      }

      // Draw Maze Walls & Dots
      for (let y = 0; y < stage.H; y++) {
        for (let x = 0; x < stage.W; x++) {
          const c = stage.grid[y][x];
          const px = x * TILE, py = y * TILE;
          if (c === "#") {
            ctx.fillStyle = "#121b47";
            ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            ctx.strokeStyle = "#304bff";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
          } else if (c === ".") {
            ctx.fillStyle = "#ffc32b";
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

      // Draw particles
      for (const pp of particles) {
        ctx.globalAlpha = Math.min(1, pp.life / 30);
        ctx.fillStyle = pp.c;
        ctx.fillRect(pp.x, pp.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // Draw Ghosts (White-Ice visual effect drawn if May's Freeze is active!)
      const powered = playMode === "online" && convexRoomData 
        ? Date.now() < convexRoomData.powerUntil 
        : performance.now() < stage.powerUntil;

      for (const g of ghosts) {
        const gp = ghostPixel(g);
        
        if (ghostsFrozen) {
          // Freeze Snowflake aura color
          drawGhost(ctx, gp.x, gp.y, "#92d4ff", false, true);
        } else {
          drawGhost(ctx, gp.x, gp.y, powered ? "#5aa9ff" : g.color, powered, false);
        }
      }

      // Draw Players
      for (const p of [may, cody]) {
        if (!p.alive) continue;
        const pp = playerPixel(p);
        
        // Ember fire trail trails drawn on Cody when sprinting
        if (p.name === "Cody" && codyDashing) {
          ctx.save();
          ctx.shadowColor = "#ff5a4d"; ctx.shadowBlur = 24;
          drawPac(ctx, pp.x, pp.y, p.color, p.glow, p.dir);
          ctx.restore();
        } else {
          drawPac(ctx, pp.x, pp.y, p.color, p.glow, p.dir);
        }
      }

      ctx.restore();
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [playMode, role, stageIdx, status, roomCode, convexRoomData, ghostsFrozen, codyDashing]);

  // Ability percentages calculations for UI
  const getCooldownPercent = (cooldownTimestamp: number) => {
    if (Date.now() >= cooldownTimestamp) return 0;
    return Math.round(((cooldownTimestamp - Date.now()) / 12000) * 100);
  };

  const getCooldownSeconds = (cooldownTimestamp: number) => {
    if (Date.now() >= cooldownTimestamp) return 0;
    return Math.ceil((cooldownTimestamp - Date.now()) / 1000);
  };

  return (
    <div className="min-h-screen w-full bg-[#04030d] text-foreground p-4 sm:p-6 flex flex-col items-center gap-4">
      {/* 1. Header Grid */}
      <div className="flex items-center justify-between w-full max-w-6xl border-b border-border/30 pb-4">
        <Link to="/" className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition">
          <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
        </Link>
        <div className="font-display font-black text-xl tracking-widest flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-may shadow-[0_0_8px_var(--color-may)] animate-pulse" />
          <span>IT TAKES TWO ONLINE</span>
          <span className="w-2.5 h-2.5 rounded-full bg-cody shadow-[0_0_8px_var(--color-cody)] animate-pulse" />
        </div>
        <button onClick={() => location.reload()} className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition">
          <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Reset Game</span>
        </button>
      </div>

      {/* 2. MATCHMAKING SCREEN */}
      {playMode === null && (
        <div className="w-full max-w-2xl bg-card/30 backdrop-blur-xl border border-border/40 rounded-md p-8 my-auto space-y-8 shadow-2xl">
          <div className="text-center space-y-3">
            <Sparkles className="w-12 h-12 mx-auto text-accent animate-pulse-glow" />
            <h2 className="font-display font-black text-4xl tracking-tight">Choose Your Adventure</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Play side-by-side with a shared keyboard, or create a real-time lobby to play with friends using Snowflake/Flame skills, chats, and global leaderboards!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setPlayMode("local")}
              className="group p-6 rounded-md border border-border/60 bg-background/40 hover:border-may/80 text-left transition space-y-4 hover:shadow-lg"
            >
              <Cpu className="w-8 h-8 text-may group-hover:scale-110 transition" />
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">Local Shared Mode</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Play on one machine. Controls: WASD for May, Arrow Keys for Cody. Space for ability.
                </p>
              </div>
            </button>

            <button
              onClick={() => setPlayMode("online")}
              className="group p-6 rounded-md border border-border/60 bg-background/40 hover:border-cody/80 text-left transition space-y-4 hover:shadow-lg"
            >
              <Wifi className="w-8 h-8 text-cody group-hover:scale-110 transition" />
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">Online Multiplayer</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Invite friends over a 4-letter room code. Syncs character positions, lobby chat, and records.
                </p>
              </div>
            </button>
          </div>

          <div className="bg-[#0b0a1d] border border-border/40 rounded p-4 text-xs flex gap-3 text-muted-foreground leading-relaxed">
            <ShieldAlert className="w-6 h-6 text-accent shrink-0" />
            <div className="space-y-1">
              <span className="font-bold text-foreground block">
                {isConvexConfigured ? "Convex Cloud Connected!" : "Convex Database Offline — Fallback Active"}
              </span>
              <span>
                {isConvexConfigured 
                  ? "Fully synced queries and global top leaderboards are active and loaded via Convex backend." 
                  : "Automatic failsafe is running using browser BroadcastChannels. Open two windows of this page at http://localhost:8080/play side-by-side to test multiplayer instantly!"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Online configuration lobby screen */}
      {playMode === "online" && !role && (
        <div className="w-full max-w-md bg-card/30 backdrop-blur-xl border border-border/40 rounded-md p-8 my-auto space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <Users className="w-10 h-10 mx-auto text-accent" />
            <h3 className="font-display font-black text-2xl uppercase tracking-widest text-foreground">Lobby Setup</h3>
            <p className="text-xs text-muted-foreground">Join or host a synced multiplayer session.</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleCreateRoom}
              className="w-full py-4 bg-duo hover:opacity-90 font-bold uppercase text-xs tracking-widest text-primary-foreground rounded-md transition shadow-[0_0_15px_var(--color-may)]"
            >
              Create New Room
            </button>

            <div className="relative flex items-center py-2">
              <span className="h-px w-full bg-border/40" />
              <span className="px-3 text-[10px] uppercase text-muted-foreground shrink-0">OR JOIN LOBBY</span>
              <span className="h-px w-full bg-border/40" />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ROOM CODE"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                className="bg-[#050410] border border-border/80 focus:border-cody text-center font-display font-bold uppercase text-sm tracking-widest rounded-md py-3 px-4 w-full"
              />
              <button
                onClick={handleJoinRoom}
                className="px-6 bg-card border border-border hover:bg-background/80 font-bold uppercase text-xs tracking-widest rounded-md transition"
              >
                Join
              </button>
            </div>
            {errorMessage && <p className="text-red-400 text-[10px] text-center uppercase tracking-wider">{errorMessage}</p>}
          </div>

          <button
            onClick={() => setPlayMode(null)}
            className="w-full text-center text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition pt-2"
          >
            ← Back to Mode Choice
          </button>
        </div>
      )}

      {/* Online waiting screen for partner */}
      {playMode === "online" && role && status === "waiting" && (
        <div className="w-full max-w-md bg-card/30 backdrop-blur-xl border border-border/40 rounded-md p-8 my-auto space-y-6 text-center shadow-2xl">
          <Users className="w-10 h-10 mx-auto text-may animate-pulse" />
          <h3 className="font-display font-black text-2xl uppercase tracking-widest text-foreground">Waiting for Cody...</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Give this Room Code to your friend. The game will launch automatically when they join.
          </p>

          <div className="bg-[#08061c] border border-border/60 rounded-md p-4 flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">SHARE CODE</span>
            <div className="flex items-center gap-2 text-3xl font-display font-black tracking-widest text-accent">
              <Key className="w-5 h-5 text-accent animate-pulse" /> {roomCode}
            </div>
          </div>

          <div className="text-xs text-muted-foreground uppercase tracking-widest border border-dashed border-border/60 py-3 rounded">
            Role: <span className="text-may font-bold">MAY (BLUE)</span>
          </div>

          {!isConvexConfigured && (
            <div className="pt-2 text-[10px] text-muted-foreground leading-normal border-t border-border/30">
              *BROWSER CO-OP FALLBACK ACTIVE*<br />
              Open another browser window at: <br />
              <span className="text-accent underline font-mono">http://localhost:8080/play</span><br />
              and enter code: <span className="font-bold text-accent">{roomCode}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. ACTIVE GAME PLAYING LAYOUT GRID */}
      {((playMode === "local") || (playMode === "online" && role && status !== "waiting")) && (
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Gameplay Screen Column (Cols 1-8) */}
          <div className="lg:col-span-8 flex flex-col items-center gap-4">
            
            {/* Top Stats Toolbar */}
            <div className="flex items-center justify-between w-full bg-card/20 border border-border/30 rounded-md p-2 sm:p-3 text-[10px] sm:text-xs uppercase tracking-[0.05em] sm:tracking-[0.2em] text-muted-foreground">
              {playMode === "online" && (
                <span className="flex items-center gap-1">
                  Lobby: <span className="text-accent font-bold">{roomCode}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
                </span>
              )}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" /> <span className="hidden sm:inline">Time: </span><span className="text-foreground font-bold">{timerSeconds}s</span></span>
              <span>Stage <span className="text-foreground font-bold">{stageIdx + 1}</span></span>
              <span><span className="hidden sm:inline">Dots </span><span className="text-accent font-bold">{score.dots}</span>/{score.total}</span>
              <span><span className="hidden sm:inline">Lives </span><span className="text-cody font-bold">{"♥".repeat(Math.max(0, score.lives))}</span></span>
            </div>

            {/* Active Canvas Game Window */}
            <div className="relative w-full flex justify-center">
              <canvas ref={canvasRef}
                className="w-full max-w-[600px] h-auto rounded-md border border-border bg-[#05040e] block touch-none shadow-2xl" />

              {/* Frozen snow screen overlay effect */}
              {ghostsFrozen && (
                <div className="absolute inset-0 bg-sky-200/10 border-2 border-sky-400/40 rounded-md pointer-events-none animate-pulse flex items-center justify-center">
                  <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-sky-300 bg-sky-950/80 px-4 py-1.5 rounded border border-sky-500/40 shadow-lg">❄️ TIME FREEZE ACTIVE</span>
                </div>
              )}

              {/* Dashed Dash screen overlay effect */}
              {codyDashing && role === "cody" && (
                <div className="absolute inset-0 border border-red-500/30 rounded-md pointer-events-none animate-pulse" />
              )}
              
              {/* Won/Lost Overlay */}
              {status === "won" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-md">
                  <div className="text-center space-y-4 px-4">
                    <Trophy className="w-12 h-12 mx-auto text-accent animate-pulse-glow" />
                    <h2 className="font-display font-black text-4xl sm:text-5xl text-duo italic">
                      Stage Cleared!
                    </h2>
                    <p className="text-muted-foreground text-xs sm:text-base">
                      Amazing timing! You cleared Stage {stageIdx + 1} in <span className="text-accent font-bold">{timerSeconds}s</span>!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                      {stageIdx + 1 < STAGES.length && (
                        <button
                          onClick={() => advanceRef.current()}
                          className="bg-duo text-primary-foreground px-8 py-3.5 text-xs uppercase tracking-[0.2em] font-bold rounded-md transition hover:scale-105 active:scale-95 shadow-[0_0_15px_var(--color-may)]"
                        >
                          Next Stage →
                        </button>
                      )}
                      <button
                        onClick={() => triggerRestartRef.current()}
                        className="border border-border text-foreground px-8 py-3.5 text-xs uppercase tracking-[0.2em] font-bold rounded-md hover:bg-card transition hover:scale-105 active:scale-95"
                      >
                        Restart Stage
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {status === "lost" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-md">
                  <div className="text-center space-y-4 px-4">
                    <ShieldAlert className="w-12 h-12 mx-auto text-cody animate-pulse" />
                    <h2 className="font-display font-black text-4xl sm:text-5xl text-cody italic">
                      Caught!
                    </h2>
                    <p className="text-muted-foreground text-xs sm:text-base">
                      No lives remaining. Re-synchronize your bonds to try again!
                    </p>
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => triggerRestartRef.current()}
                        className="bg-cody text-white px-8 py-3.5 text-xs uppercase tracking-[0.2em] font-bold rounded-md transition hover:scale-105 active:scale-95 shadow-[0_0_15px_var(--color-cody)]"
                      >
                        Restart Stage
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ABILITIES ACTIONS BUTTONS BAR */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              {/* May Ability Activation */}
              {(playMode === "local" || role === "may") && (
                <div className="flex flex-col items-center gap-2 bg-may/10 border border-may/40 p-3 rounded-md">
                  <button
                    onClick={handleUseSkill}
                    disabled={Date.now() < maySkillCooldown}
                    className={`w-full py-3 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition ${
                      Date.now() < maySkillCooldown
                        ? "bg-muted-foreground/10 text-muted-foreground cursor-not-allowed"
                        : "bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_15px_rgba(90,169,255,0.4)] active:scale-95"
                    }`}
                  >
                    <Snowflake className="w-4 h-4" />
                    {Date.now() < maySkillCooldown 
                      ? `Locked (${getCooldownSeconds(maySkillCooldown)}s)` 
                      : "TIME FREEZE [Space]"}
                  </button>
                  <div className="w-full bg-background/50 h-1 rounded overflow-hidden">
                    <div 
                      className="bg-may h-full transition-all duration-300"
                      style={{ width: `${getCooldownPercent(maySkillCooldown)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Cody Ability Activation */}
              {(playMode === "local" || role === "cody") && (
                <div className="flex flex-col items-center gap-2 bg-cody/10 border border-cody/40 p-3 rounded-md">
                  <button
                    onClick={handleUseSkill}
                    disabled={Date.now() < codySkillCooldown}
                    className={`w-full py-3 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition ${
                      Date.now() < codySkillCooldown
                        ? "bg-muted-foreground/10 text-muted-foreground cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(255,90,77,0.4)] active:scale-95"
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                    {Date.now() < codySkillCooldown 
                      ? `Locked (${getCooldownSeconds(codySkillCooldown)}s)` 
                      : "BLAZE DASH [Space]"}
                  </button>
                  <div className="w-full bg-background/50 h-1 rounded overflow-hidden">
                    <div 
                      className="bg-cody h-full transition-all duration-300"
                      style={{ width: `${getCooldownPercent(codySkillCooldown)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* D-Pads */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              {(playMode === "local" || role === "may") && (
                <DPad color="may" name="May" icon={<Snowflake className="w-3 h-3" />}
                  onMove={(d) => touchMove("may", d)} />
              )}
              {(playMode === "local" || role === "cody") && (
                <DPad color="cody" name="Cody" icon={<Flame className="w-3 h-3" />}
                  onMove={(d) => touchMove("cody", d)} />
              )}
            </div>
            
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              {playMode === "online" 
                ? `Role active: ${role === "may" ? "May (Blue) · WASD keys" : "Cody (Red) · Arrow keys"}` 
                : "Controls: WASD (May) + Arrows (Cody)"}
            </p>
          </div>

          {/* Mobile Tab Selectors */}
          <div className="lg:hidden flex border border-border/30 rounded-md w-full bg-[#080616]/60 backdrop-blur p-1 mt-2">
            <button
              onClick={() => setMobileActiveTab(mobileActiveTab === "chat" ? "hidden" : "chat")}
              className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold rounded transition ${
                mobileActiveTab === "chat" 
                  ? "bg-may text-white font-black shadow-[0_0_12px_rgba(90,169,255,0.4)]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              Lobby Chat
            </button>
            <button
              onClick={() => setMobileActiveTab(mobileActiveTab === "leaderboard" ? "hidden" : "leaderboard")}
              className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold rounded transition ${
                mobileActiveTab === "leaderboard" 
                  ? "bg-cody text-white font-black shadow-[0_0_12px_rgba(255,90,77,0.4)]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              Leaderboard
            </button>
          </div>

          {/* Real-time Chats & Leaderboards Column (Cols 9-12) */}
          <div className={`lg:col-span-4 flex flex-col gap-6 w-full ${
            mobileActiveTab === "hidden" ? "hidden lg:flex" : "flex"
          } h-[420px] lg:h-[590px]`}>
            
            {/* LOBBY CHAT CONTAINER */}
            <div className={`bg-card/20 border border-border/30 rounded-md p-4 flex flex-col gap-3 h-full lg:h-1/2 min-h-[300px] ${
              mobileActiveTab === "chat" ? "flex" : "hidden lg:flex"
            }`}>
              <div className="flex items-center justify-between border-b border-border/30 pb-2">
                <span className="font-display font-bold text-xs uppercase tracking-widest text-accent">Lobby Chat</span>
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Users className="w-3 h-3" /> Sync Active
                </span>
              </div>

              {/* Chat Scroll List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs max-h-[220px]">
                {localChats.map((c, i) => {
                  const isSystem = c.sender === "System";
                  const isSenderMay = c.sender === "May";
                  const senderColor = isSystem 
                    ? "text-accent font-bold" 
                    : isSenderMay 
                      ? "text-may font-bold" 
                      : "text-cody font-bold";
                  
                  return (
                    <div key={i} className={`p-2 rounded bg-background/40 border border-border/20 ${isSystem ? "border-dashed" : ""}`}>
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span className={senderColor}>{c.sender}</span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-normal break-words">{c.text}</p>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Chats suggestions */}
              <div className="flex flex-wrap gap-1 border-t border-border/30 pt-2">
                {["Freeze!", "Blaze Dash!", "Nice!", "Watch out!", "Wait up!"].map(txt => (
                  <button
                    key={txt}
                    onClick={() => handleSendMessage(txt)}
                    className="px-2 py-1 bg-card hover:bg-background border border-border/60 text-[9px] uppercase tracking-wider rounded transition"
                  >
                    {txt}
                  </button>
                ))}
              </div>

              {/* Chat typing field */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="TYPE COORDINATION..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                  className="flex-grow bg-[#04030a] border border-border/80 text-xs px-3 py-2 rounded focus:border-may"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="p-2 bg-may text-white rounded hover:opacity-90 active:scale-95 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CO-OP LEADERBOARD CONTAINER */}
            <div className={`bg-card/20 border border-border/30 rounded-md p-4 flex flex-col gap-3 h-full lg:h-1/2 min-h-[250px] ${
              mobileActiveTab === "leaderboard" ? "flex" : "hidden lg:flex"
            }`}>
              <div className="flex items-center justify-between border-b border-border/30 pb-2">
                <span className="font-display font-bold text-xs uppercase tracking-widest text-accent flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> Records Leaderboard
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">Stage {stageIdx + 1}</span>
              </div>

              <div className="flex-grow overflow-y-auto space-y-2 text-xs max-h-[200px]">
                {playMode === "online" && isConvexConfigured ? (
                  // Convex cloud leaderboard
                  convexLeaderboard && convexLeaderboard.length > 0 ? (
                    convexLeaderboard.map((rec: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 rounded bg-background/50 border border-border/20">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-accent"># {idx + 1}</span>
                          <span className="text-muted-foreground">Lobby: {rec.roomCode}</span>
                        </div>
                        <div className="font-bold text-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-may" /> {rec.clearTimeSeconds}s
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-6 uppercase tracking-wider text-[10px]">No online clears registered yet. Be the first!</div>
                  )
                ) : (
                  // Local localStorage leaderboards
                  localLeaderboard.filter(rec => rec.stageIdx === stageIdx).length > 0 ? (
                    localLeaderboard
                      .filter(rec => rec.stageIdx === stageIdx)
                      .slice(0, 5)
                      .map((rec, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded bg-background/50 border border-border/20">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-accent"># {idx + 1}</span>
                            <span className="text-muted-foreground">Local Clear ({rec.date})</span>
                          </div>
                          <div className="font-bold text-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-may" /> {rec.scoreSeconds}s
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center text-muted-foreground py-6 uppercase tracking-wider text-[10px]">No local clears registered yet. Clean the maze!</div>
                  )
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// Visual D-Pad
function DPad({ color, name, icon, onMove }: {
  color: "may" | "cody"; name: string; icon: React.ReactNode;
  onMove: (d: "up" | "down" | "left" | "right") => void;
}) {
  const isMay = color === "may";
  const textColor = isMay ? "text-may" : "text-cody";
  const btnCls = isMay
    ? "bg-[oklch(0.68_0.18_240/0.15)] active:bg-[oklch(0.68_0.18_240/0.45)] border-[oklch(0.68_0.18_240/0.6)] text-may"
    : "bg-[oklch(0.66_0.22_28/0.15)] active:bg-[oklch(0.66_0.22_28/0.45)] border-[oklch(0.66_0.22_28/0.6)] text-cody";
    
  const Btn = ({ d, children }: { d: "up"|"down"|"left"|"right"; children: React.ReactNode }) => (
    <button
      onPointerDown={(e) => { e.preventDefault(); onMove(d); }}
      className={`${btnCls} border rounded-md font-bold text-lg select-none active:scale-95 transition flex items-center justify-center`}
      style={{ touchAction: "none" }}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-2 mx-auto">
      <div className={`flex items-center gap-1.5 ${textColor} font-display font-bold tracking-widest text-[10px]`}>
        {icon} {name.toUpperCase()}
      </div>
      <div className="grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32 text-xs">
        <div />
        <Btn d="up">▲</Btn>
        <div />
        <Btn d="left">◀</Btn>
        <div />
        <Btn d="right">▶</Btn>
        <div />
        <Btn d="down">▼</Btn>
        <div />
      </div>
    </div>
  );
}

// Visual drawing components
function drawPac(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, glow: string, dir: Dir) {
  const r = TILE * 0.42;
  const mouth = (Math.sin(performance.now() / 80) + 1) / 2 * 0.5 + 0.05;
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

function drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scared: boolean, frozen: boolean = false) {
  const r = TILE * 0.42;
  ctx.save();
  
  if (frozen) {
    ctx.shadowColor = "#92d4ff"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#92d4ff";
  } else {
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillStyle = color;
  }
  
  ctx.beginPath();
  ctx.arc(x, y - 2, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r);
  
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

  // Ice cube look if frozen
  if (frozen) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
  }

  // Eyes drawing
  ctx.fillStyle = frozen ? "rgba(255,255,255,0.8)" : "white";
  ctx.beginPath(); ctx.arc(x - 5, y - 2, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 2, 3.2, 0, Math.PI * 2); ctx.fill();
  
  ctx.fillStyle = frozen ? "#308bff" : scared ? "#fff" : "#191530";
  ctx.beginPath(); ctx.arc(x - 5, y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5, y - 1, 1.6, 0, Math.PI * 2); ctx.fill();
}
