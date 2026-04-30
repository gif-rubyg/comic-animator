import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signSession } from "./auth";
import {
  getUserByEmail, getUserById, createUser, updateUserName, updateUserPassword, countUsers,
  getProjectsByUser, getProjectById, createProject, updateProject, deleteProject,
  getPanelsByProject, createPanel, updatePanel, deletePanel,
  getLayersByPanel, createLayer, updateLayer, deleteLayer,
} from "./db";

const LayerAnimationSchema = z.object({
  type: z.string(),
  startTime: z.number(),
  duration: z.number(),
  repeat: z.boolean(),
  intensity: z.number(),
});

const PanZoomSchema = z.object({
  enabled: z.boolean(),
  startX: z.number(), startY: z.number(), startScale: z.number(),
  endX: z.number(), endY: z.number(), endScale: z.number(),
}).nullable();

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ─────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      const { passwordHash: _, ...safe } = opts.ctx.user;
      return safe;
    }),

    login: publicProcedure.input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });

      const token = await signSession({ userId: user.id, email: user.email });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const { passwordHash: _, ...safe } = user;
      return { success: true, user: safe };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    updateName: protectedProcedure.input(z.object({
      name: z.string().min(1).max(100),
    })).mutation(async ({ ctx, input }) => {
      await updateUserName(ctx.user.id, input.name);
      return { success: true };
    }),

    changePassword: protectedProcedure.input(z.object({
      currentPassword: z.string().min(6),
      newPassword: z.string().min(6),
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      const hash = await bcrypt.hash(input.newPassword, 12);
      await updateUserPassword(ctx.user.id, hash);
      return { success: true };
    }),
  }),

  // ─── Projects ─────────────────────────────────────────────────────────────
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getProjectsByUser(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      return project;
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().default("Untitled Project"),
      aspectRatio: z.enum(["9:16", "4:3"]).default("9:16"),
    })).mutation(async ({ ctx, input }) => {
      const project = await createProject({ ...input, userId: ctx.user.id });
      return project;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      aspectRatio: z.enum(["9:16", "4:3"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await getProjectById(id);
      if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await updateProject(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await deleteProject(input.id);
      return { success: true };
    }),
  }),

  // ─── Panels ───────────────────────────────────────────────────────────────
  panels: router({
    list: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      return getPanelsByProject(input.projectId);
    }),
    create: protectedProcedure.input(z.object({
      projectId: z.number(),
      order: z.number().optional(),
      backgroundUrl: z.string().optional(),
      duration: z.number().optional(),
      transition: z.enum(["none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out"]).optional(),
      transitionDuration: z.number().optional(),
      panZoom: PanZoomSchema.optional(),
    })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      const panel = await createPanel(input as any);
      return panel;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      order: z.number().optional(),
      backgroundUrl: z.string().optional(),
      duration: z.number().optional(),
      transition: z.enum(["none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out"]).optional(),
      transitionDuration: z.number().optional(),
      panZoom: PanZoomSchema.optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updatePanel(id, data as any);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deletePanel(input.id);
      return { success: true };
    }),
  }),

  // ─── Layers ───────────────────────────────────────────────────────────────
  layers: router({
    list: protectedProcedure.input(z.object({ panelId: z.number() })).query(async ({ input }) => {
      return getLayersByPanel(input.panelId);
    }),
    create: protectedProcedure.input(z.object({
      panelId: z.number(),
      name: z.string().optional(),
      imageUrl: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      zIndex: z.number().optional(),
      flipX: z.number().optional(),
      animations: z.array(LayerAnimationSchema).optional(),
    })).mutation(async ({ input }) => {
      const layer = await createLayer(input as any);
      return layer;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      imageUrl: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      zIndex: z.number().optional(),
      flipX: z.number().optional(),
      animations: z.array(LayerAnimationSchema).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateLayer(id, data as any);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteLayer(input.id);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
