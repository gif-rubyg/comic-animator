import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getProjectsByUser, getProjectById, createProject, updateProject, deleteProject,
  getPanelsByProject, createPanel, updatePanel, deletePanel,
  getLayersByPanel, createLayer, updateLayer, deleteLayer,
} from "./db";
import { storageGet, storageGetSignedUrl } from "./storage";
import { ENV } from "./_core/env";

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
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getProjectsByUser(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) throw new Error("Not found");
      return project;
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().default("Untitled Project"),
      aspectRatio: z.enum(["9:16", "4:3"]).default("9:16"),
    })).mutation(async ({ ctx, input }) => {
      const id = await createProject({ ...input, userId: ctx.user.id });
      return { id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      aspectRatio: z.enum(["9:16", "4:3"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await getProjectById(id);
      if (!project || project.userId !== ctx.user.id) throw new Error("Not found");
      await updateProject(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) throw new Error("Not found");
      await deleteProject(input.id);
      return { success: true };
    }),
  }),

  panels: router({
    list: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) throw new Error("Not found");
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
      if (!project || project.userId !== ctx.user.id) throw new Error("Not found");
      const id = await createPanel(input as any);
      return { id };
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
      const id = await createLayer(input as any);
      return { id };
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

  upload: router({
    // Get a presigned PUT URL from Forge for direct browser upload
    presignPut: protectedProcedure.input(z.object({
      filename: z.string(),
      contentType: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const forgeUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
      const forgeKey = ENV.forgeApiKey;
      if (!forgeUrl || !forgeKey) throw new Error("Storage not configured");
      const key = `uploads/${ctx.user.id}/${Date.now()}-${input.filename}`;
      const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
      presignUrl.searchParams.set("path", key);
      const resp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
      if (!resp.ok) throw new Error("Failed to get presigned URL");
      const { url: s3Url } = await resp.json() as { url: string };
      return { s3Url, key, serveUrl: `/manus-storage/${key}` };
    }),
    getUrl: protectedProcedure.input(z.object({ key: z.string() })).query(async ({ input }) => {
      const { url } = await storageGet(input.key);
      return { url };
    }),
  }),
});

export type AppRouter = typeof appRouter;
