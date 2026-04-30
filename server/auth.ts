/**
 * Email + Password Authentication
 * Replaces Manus OAuth. Uses JWT cookies signed with JWT_SECRET.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getUserById } from "./db";
import type { User } from "../drizzle/schema";

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
};

export interface SessionPayload {
  userId: number;
  email: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(getSecret());
}

export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSecret(), { algorithms: ["HS256"] });
    const { userId, email } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || typeof email !== "string") return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<User | null> {
  const raw = req.headers.cookie ?? "";
  const cookies = parseCookieHeader(raw);
  const token = cookies[COOKIE_NAME];
  const session = await verifySession(token);
  if (!session) return null;
  const user = await getUserById(session.userId);
  return user ?? null;
}
