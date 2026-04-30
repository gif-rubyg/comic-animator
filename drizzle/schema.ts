import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float } from "drizzle-orm/mysql-core";

/**
 * Core user table — email/password auth (no OAuth)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects table — one project per animated reel
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull().default("Untitled Project"),
  aspectRatio: mysqlEnum("aspectRatio", ["9:16", "4:3"]).notNull().default("9:16"),
  isPublic: int("isPublic").notNull().default(0),
  likesCount: int("likesCount").notNull().default(0),
  bgMusicUrl: text("bgMusicUrl"),
  bgMusicVolume: float("bgMusicVolume").notNull().default(0.8),
  thumbnailUrl: text("thumbnailUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Panels table — each panel is one "scene" in the reel
 */
export const panels = mysqlTable("panels", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  order: int("order").notNull().default(0),
  backgroundUrl: text("backgroundUrl"),
  duration: float("duration").notNull().default(3.0),
  transition: mysqlEnum("transition", ["none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out"]).notNull().default("fade"),
  transitionDuration: float("transitionDuration").notNull().default(0.5),
  audioUrl: text("audioUrl"),
  audioVolume: float("audioVolume").notNull().default(1.0),
  panZoom: json("panZoom").$type<{
    enabled: boolean;
    startX: number; startY: number; startScale: number;
    endX: number; endY: number; endScale: number;
  } | null>(),
  speechBubbles: text("speechBubbles").$type<SpeechBubble[]>(),
  stickers: text("stickers"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Panel = typeof panels.$inferSelect;
export type InsertPanel = typeof panels.$inferInsert;

export interface SpeechBubble {
  id: string;
  text: string;
  style: "speech" | "thought" | "shout" | "whisper";
  tailDirection: "left" | "right" | "up" | "down" | "none";
  x: number;       // % from left
  y: number;       // % from top
  width: number;   // % of canvas width
  fontSize: number;
  fontColor: string;
  bgColor: string;
  borderColor: string;
}

export type AnimationType =
  | "blink" | "wink-left" | "wink-right"
  | "eye-look-left" | "eye-look-right" | "eye-look-up" | "eye-look-down" | "eye-wander"
  | "wave-hand" | "hug" | "kiss" | "laugh"
  | "fat-thin" | "ear-scale" | "hair-fly"
  | "sit-down" | "get-up"
  | "walk" | "run" | "crawl"
  | "move-left" | "move-right"
  | "bounce" | "shake" | "spin"
  | "fade-in" | "fade-out"
  | "zoom-in" | "zoom-out"
  | "float";

export interface LayerAnimation {
  type: AnimationType;
  startTime: number;
  duration: number;
  repeat: boolean;
  intensity: number;
}

/**
 * Layers table — character/element layers on top of a panel background
 */
export const layers = mysqlTable("layers", {
  id: int("id").autoincrement().primaryKey(),
  panelId: int("panelId").notNull(),
  name: varchar("name", { length: 255 }).notNull().default("Layer"),
  imageUrl: text("imageUrl"),
  x: float("x").notNull().default(0),
  y: float("y").notNull().default(0),
  width: float("width").notNull().default(30),
  height: float("height").notNull().default(50),
  zIndex: int("zIndex").notNull().default(0),
  flipX: int("flipX").notNull().default(0),
  animations: json("animations").$type<LayerAnimation[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Layer = typeof layers.$inferSelect;
export type InsertLayer = typeof layers.$inferInsert;
