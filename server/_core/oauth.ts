/**
 * OAuth routes disabled - app uses email/password authentication.
 * Login is handled via tRPC procedures in server/routers.ts.
 */
import type { Express } from "express";

export function registerOAuthRoutes(_app: Express) {
  // No-op: OAuth replaced by email/password auth
}
