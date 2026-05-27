import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    roomCode: v.string(),
    stageIdx: v.number(),
    dotsEaten: v.number(),
    lives: v.number(),
    may: v.object({
      x: v.number(),
      y: v.number(),
      nextX: v.number(),
      nextY: v.number(),
      dirX: v.number(),
      dirY: v.number(),
      t: v.number(),
      alive: v.boolean(),
      lastActive: v.number(),
    }),
    cody: v.object({
      x: v.number(),
      y: v.number(),
      nextX: v.number(),
      nextY: v.number(),
      dirX: v.number(),
      dirY: v.number(),
      t: v.number(),
      alive: v.boolean(),
      lastActive: v.number(),
    }),
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
    eatenDots: v.array(v.string()), // Formatted as "x,y"
    powerUntil: v.number(), // timestamp (ms)
    status: v.string(), // "waiting" | "playing" | "won" | "lost"
    players: v.object({
      mayJoined: v.boolean(),
      codyJoined: v.boolean(),
    }),
    lastInteraction: v.number(),
    
    // NEW CHAT & ABILITIES & TIMERS
    chat: v.array(
      v.object({
        sender: v.string(), // "May" | "Cody"
        text: v.string(),
        time: v.number(),
      })
    ),
    stageStartTime: v.number(), // to compute clear time for leaderboard
    ghostsFrozenUntil: v.number(), // May's snowflake ability timer
    codyDashActiveUntil: v.number(), // Cody's flame ability active timer
  }).index("by_roomCode", ["roomCode"]),

  leaderboard: defineTable({
    roomCode: v.string(),
    stageIdx: v.number(),
    clearTimeSeconds: v.number(),
    timestamp: v.number(),
  }).index("by_stageIdx", ["stageIdx"]),
});
