import { eq, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, panels, layers, InsertProject, InsertPanel, InsertLayer, Project, Panel, Layer } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function getProjectsByUser(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId));
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  return (result as any)[0].insertId;
}

export async function updateProject(id: number, data: Partial<InsertProject>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete layers and panels first
  const panelList = await db.select().from(panels).where(eq(panels.projectId, id));
  for (const panel of panelList) {
    await db.delete(layers).where(eq(layers.panelId, panel.id));
  }
  await db.delete(panels).where(eq(panels.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Panels ─────────────────────────────────────────────────────────────────

export async function getPanelsByProject(projectId: number): Promise<Panel[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(panels).where(eq(panels.projectId, projectId)).orderBy(asc(panels.order));
}

export async function createPanel(data: InsertPanel): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(panels).values(data);
  return (result as any)[0].insertId;
}

export async function updatePanel(id: number, data: Partial<InsertPanel>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(panels).set(data).where(eq(panels.id, id));
}

export async function deletePanel(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(layers).where(eq(layers.panelId, id));
  await db.delete(panels).where(eq(panels.id, id));
}

// ─── Layers ──────────────────────────────────────────────────────────────────

export async function getLayersByPanel(panelId: number): Promise<Layer[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(layers).where(eq(layers.panelId, panelId)).orderBy(asc(layers.zIndex));
}

export async function createLayer(data: InsertLayer): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(layers).values(data);
  return (result as any)[0].insertId;
}

export async function updateLayer(id: number, data: Partial<InsertLayer>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(layers).set(data).where(eq(layers.id, id));
}

export async function deleteLayer(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(layers).where(eq(layers.id, id));
}
