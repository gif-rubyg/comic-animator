import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
  updateUserName: vi.fn(),
  updateUserPassword: vi.fn(),
  countUsers: vi.fn(),
  getProjectsByUser: vi.fn(),
  getProjectById: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getPanelsByProject: vi.fn(),
  createPanel: vi.fn(),
  updatePanel: vi.fn(),
  deletePanel: vi.fn(),
  getLayersByPanel: vi.fn(),
  createLayer: vi.fn(),
  updateLayer: vi.fn(),
  deleteLayer: vi.fn(),
}));

import * as db from "./db";

function createCtx(user: TrpcContext["user"] = null): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const setCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
    } as unknown as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.me", () => {
  it("returns null when not authenticated", async () => {
    const { ctx } = createCtx(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user without passwordHash when authenticated", async () => {
    const user = {
      id: 1,
      email: "test@example.com",
      name: "Test User",
      passwordHash: "secret-hash",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const { ctx } = createCtx(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect((result as any)?.passwordHash).toBeUndefined();
    expect(result?.email).toBe("test@example.com");
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("auth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws UNAUTHORIZED for unknown email", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
    const { ctx } = createCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.login({ email: "nobody@example.com", password: "password123" })
    ).rejects.toThrow("Invalid email or password");
  });
});
