import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const STAGES = [
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
    "###############"
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
    "###############"
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
    "###############"
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
    "###############"
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
    "###############"
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

function parseSpawns(stageIdx: number) {
  const map = STAGES[stageIdx].map;
  let may = { x: 1, y: 1 };
  let cody = { x: 1, y: 1 };
  const ghosts: { x: number; y: number; nextX: number; nextY: number; dirX: number; dirY: number; t: number; color: string }[] = [];
  const palette = ["#ff6ab2", "#a78bfa", "#fcd34d", "#5eead4"];

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const c = map[y][x];
      if (c === "M") { may = { x, y }; }
      else if (c === "C") { cody = { x, y }; }
      else if (c === "G") {
        ghosts.push({
          x, y,
          nextX: x, nextY: y,
          dirX: 0, dirY: 0, t: 0,
          color: palette[ghosts.length % palette.length],
        });
      }
    }
  }
  return { may, cody, ghosts };
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 1. Create room
export const createRoom = mutation({
  args: {},
  handler: async (ctx) => {
    let roomCode = generateRoomCode();
    let existing = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
      .first();
    
    while (existing) {
      roomCode = generateRoomCode();
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
        .first();
    }

    const { may, cody, ghosts } = parseSpawns(0);

    const roomId = await ctx.db.insert("rooms", {
      roomCode,
      stageIdx: 0,
      dotsEaten: 0,
      lives: 3,
      may: {
        x: may.x, y: may.y,
        nextX: may.x, nextY: may.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
        lastActive: Date.now(),
      },
      cody: {
        x: cody.x, y: cody.y,
        nextX: cody.x, nextY: cody.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
        lastActive: Date.now(),
      },
      ghosts,
      eatenDots: [],
      powerUntil: 0,
      status: "waiting",
      players: {
        mayJoined: false,
        codyJoined: false,
      },
      lastInteraction: Date.now(),
      chat: [
        { sender: "System", text: "Welcome to the game lobby! Ready your bonds.", time: Date.now() }
      ],
      stageStartTime: Date.now(),
      ghostsFrozenUntil: 0,
      codyDashActiveUntil: 0,
    });

    return { roomId, roomCode };
  },
});

// 2. Query room
export const getRoom = query({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();
  },
});

// 3. Join room
export const joinRoom = mutation({
  args: { roomCode: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) throw new Error("Room not found");

    const players = { ...room.players };
    if (args.role === "may") {
      players.mayJoined = true;
    } else if (args.role === "cody") {
      players.codyJoined = true;
    }

    let status = room.status;
    const chat = [...room.chat];
    
    if (args.role === "may" || args.role === "cody") {
      chat.push({
        sender: "System",
        text: `${args.role === "may" ? "May" : "Cody"} has connected!`,
        time: Date.now(),
      });
    }

    if (players.mayJoined && players.codyJoined && status === "waiting") {
      status = "playing";
      chat.push({
        sender: "System",
        text: "Both players connected. The adventure begins!",
        time: Date.now(),
      });
    }

    await ctx.db.patch(room._id, {
      players,
      status,
      chat,
      stageStartTime: Date.now(), // start clock when game starts
      lastInteraction: Date.now(),
    });

    return room;
  },
});

// 4. Update player coordinates
export const updatePlayer = mutation({
  args: {
    roomCode: v.string(),
    role: v.string(),
    x: v.number(),
    y: v.number(),
    nextX: v.number(),
    nextY: v.number(),
    dirX: v.number(),
    dirY: v.number(),
    t: v.number(),
    alive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const updateData = {
      x: args.x,
      y: args.y,
      nextX: args.nextX,
      nextY: args.nextY,
      dirX: args.dirX,
      dirY: args.dirY,
      t: args.t,
      alive: args.alive,
      lastActive: Date.now(),
    };

    if (args.role === "may") {
      await ctx.db.patch(room._id, {
        may: updateData,
        lastInteraction: Date.now(),
      });
    } else if (args.role === "cody") {
      await ctx.db.patch(room._id, {
        cody: updateData,
        lastInteraction: Date.now(),
      });
    }
  },
});

// 5. Update ghost coordinates
export const updateGhosts = mutation({
  args: {
    roomCode: v.string(),
    ghosts: v.array(
      v.object({
        x: v.number(),
        y: v.number(),
        nextX: v.number(),
        nextY: v.number(),
        dirX: v.number(),
        dirY: v.number(),
        t: v.number(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    await ctx.db.patch(room._id, {
      ghosts: args.ghosts,
      lastInteraction: Date.now(),
    });
  },
});

// 6. Eat dot
export const eatDot = mutation({
  args: {
    roomCode: v.string(),
    x: v.number(),
    y: v.number(),
    dotType: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const dotKey = `${args.x},${args.y}`;
    if (room.eatenDots.includes(dotKey)) return;

    const eatenDots = [...room.eatenDots, dotKey];
    let powerUntil = room.powerUntil;
    if (args.dotType === "power") {
      powerUntil = Date.now() + 6000;
    }

    await ctx.db.patch(room._id, {
      eatenDots,
      dotsEaten: room.dotsEaten + 1,
      powerUntil,
      lastInteraction: Date.now(),
    });
  },
});

// 7. Player got caught
export const playerDeath = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const newLives = Math.max(0, room.lives - 1);
    const { may, cody, ghosts } = parseSpawns(room.stageIdx);

    const chat = [...room.chat];
    chat.push({
      sender: "System",
      text: `Oops! Player caught! ${newLives} lives remaining.`,
      time: Date.now(),
    });

    const patchData: any = {
      lives: newLives,
      may: {
        ...room.may,
        x: may.x, y: may.y,
        nextX: may.x, nextY: may.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
      },
      cody: {
        ...room.cody,
        x: cody.x, y: cody.y,
        nextX: cody.x, nextY: cody.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
      },
      ghosts,
      chat,
      ghostsFrozenUntil: 0,
      codyDashActiveUntil: 0,
      lastInteraction: Date.now(),
    };

    if (newLives <= 0) {
      patchData.status = "lost";
    }

    await ctx.db.patch(room._id, patchData);
  },
});

// 8. Restart room
export const resetRoom = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const { may, cody, ghosts } = parseSpawns(room.stageIdx);
    const chat = [...room.chat];
    chat.push({
      sender: "System",
      text: "Lobby reset. Get ready!",
      time: Date.now(),
    });

    await ctx.db.patch(room._id, {
      status: "playing",
      lives: 3,
      dotsEaten: 0,
      eatenDots: [],
      powerUntil: 0,
      may: {
        ...room.may,
        x: may.x, y: may.y,
        nextX: may.x, nextY: may.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
      },
      cody: {
        ...room.cody,
        x: cody.x, y: cody.y,
        nextX: cody.x, nextY: cody.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
      },
      ghosts,
      chat,
      stageStartTime: Date.now(),
      ghostsFrozenUntil: 0,
      codyDashActiveUntil: 0,
      lastInteraction: Date.now(),
    });
  },
});

// 9. Advance stage
export const advanceStage = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const nextStageIdx = (room.stageIdx + 1) % STAGES.length;
    const { may, cody, ghosts } = parseSpawns(nextStageIdx);
    const chat = [...room.chat];
    chat.push({
      sender: "System",
      text: `Advancing to Chapter ${nextStageIdx + 1}!`,
      time: Date.now(),
    });

    await ctx.db.patch(room._id, {
      stageIdx: nextStageIdx,
      status: "playing",
      dotsEaten: 0,
      eatenDots: [],
      powerUntil: 0,
      may: {
        ...room.may,
        x: may.x, y: may.y,
        nextX: may.x, nextY: may.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
      },
      cody: {
        ...room.cody,
        x: cody.x, y: cody.y,
        nextX: cody.x, nextY: cody.y,
        dirX: 0, dirY: 0, t: 0,
        alive: true,
      },
      ghosts,
      chat,
      stageStartTime: Date.now(),
      ghostsFrozenUntil: 0,
      codyDashActiveUntil: 0,
      lastInteraction: Date.now(),
    });
  },
});

// 10. Send Chat Message
export const sendChatMessage = mutation({
  args: { roomCode: v.string(), sender: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const chat = [...room.chat, {
      sender: args.sender,
      text: args.text,
      time: Date.now(),
    }];

    await ctx.db.patch(room._id, {
      chat,
      lastInteraction: Date.now(),
    });
  },
});

// 11. Trigger Character Special Co-op Ability
export const useAbility = mutation({
  args: { roomCode: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room) return;

    const patchData: any = { lastInteraction: Date.now() };
    const chat = [...room.chat];

    if (args.role === "may") {
      patchData.ghostsFrozenUntil = Date.now() + 4000;
      chat.push({
        sender: "May",
        text: "❄️ TIME FREEZE! Ghosts frozen for 4s!",
        time: Date.now(),
      });
    } else if (args.role === "cody") {
      patchData.codyDashActiveUntil = Date.now() + 3000;
      chat.push({
        sender: "Cody",
        text: "🔥 BLAZE DASH! Cody double speed for 3s!",
        time: Date.now(),
      });
    }

    patchData.chat = chat;
    await ctx.db.patch(room._id, patchData);
  },
});

// 12. Record Stage Clear record into Leaderboards
export const recordStageClear = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode.toUpperCase()))
      .first();

    if (!room || room.status === "won") return;

    const durationSeconds = Math.max(1, Math.round((Date.now() - room.stageStartTime) / 1000));
    
    // Write into leaderboard table
    await ctx.db.insert("leaderboard", {
      roomCode: args.roomCode,
      stageIdx: room.stageIdx,
      clearTimeSeconds: durationSeconds,
      timestamp: Date.now(),
    });

    const chat = [...room.chat];
    chat.push({
      sender: "System",
      text: `🏆 STAGE CLEARED in ${durationSeconds} seconds! Record saved.`,
      time: Date.now(),
    });

    await ctx.db.patch(room._id, {
      status: "won",
      chat,
      lastInteraction: Date.now(),
    });
  },
});

// 13. Query Leaderboard entries for a stage
export const getLeaderboard = query({
  args: { stageIdx: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leaderboard")
      .withIndex("by_stageIdx", (q) => q.eq("stageIdx", args.stageIdx))
      .order("asc") // Fastest times first
      .take(5); // top 5 speeds
  },
});
