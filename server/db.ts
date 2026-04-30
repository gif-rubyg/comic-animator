import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, projects, panels, layers } from "../drizzle/schema";
import type { InsertUser, InsertProject, InsertPanel, InsertLayer } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values(data);
  return getUserByEmail(data.email);
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function updateUserName(id: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ name }).where(eq(users.id, id));
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function countUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(users);
  return result.length;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  const insertId = (result as any)[0]?.insertId;
  return getProjectById(insertId);
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
  return getProjectById(id);
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete layers for all panels first
  const projectPanels = await db.select().from(panels).where(eq(panels.projectId, id));
  for (const panel of projectPanels) {
    await db.delete(layers).where(eq(layers.panelId, panel.id));
  }
  await db.delete(panels).where(eq(panels.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Panels ──────────────────────────────────────────────────────────────────

export async function getPanelsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(panels).where(eq(panels.projectId, projectId)).orderBy(panels.order);
}

export async function getPanelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(panels).where(eq(panels.id, id)).limit(1);
  return result[0];
}

export async function createPanel(data: InsertPanel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(panels).values(data);
  const insertId = (result as any)[0]?.insertId;
  return getPanelById(insertId);
}

export async function updatePanel(id: number, data: Partial<InsertPanel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(panels).set(data).where(eq(panels.id, id));
  return getPanelById(id);
}

export async function deletePanel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(layers).where(eq(layers.panelId, id));
  await db.delete(panels).where(eq(panels.id, id));
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

export async function getPublicProjects() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: projects.id,
      name: projects.name,
      aspectRatio: projects.aspectRatio,
      likesCount: projects.likesCount,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      userId: projects.userId,
      userName: users.name,
    })
    .from(projects)
    .leftJoin(users, eq(projects.userId, users.id))
    .where(eq(projects.isPublic, 1))
    .orderBy(desc(projects.updatedAt));
}

export async function likeProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects)
    .set({ likesCount: sql`${projects.likesCount} + 1` })
    .where(eq(projects.id, id));
}

// ─── Layers ──────────────────────────────────────────────────────────────────

export async function getLayersByPanel(panelId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(layers).where(eq(layers.panelId, panelId)).orderBy(layers.zIndex);
}

export async function getLayerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(layers).where(eq(layers.id, id)).limit(1);
  return result[0];
}

export async function createLayer(data: InsertLayer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(layers).values(data);
  const insertId = (result as any)[0]?.insertId;
  return getLayerById(insertId);
}

export async function updateLayer(id: number, data: Partial<InsertLayer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(layers).set(data).where(eq(layers.id, id));
  return getLayerById(id);
}

export async function deleteLayer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(layers).where(eq(layers.id, id));
}
