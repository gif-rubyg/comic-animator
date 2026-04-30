import { describe, it, expect } from "vitest";
import { computeLayerState, stateToTransform, ANIMATION_CATALOG, type LayerAnimation } from "./animationEngine";

describe("animationEngine", () => {
  it("returns default state when no animations", () => {
    const state = computeLayerState(0, [], 360);
    expect(state.translateX).toBe(0);
    expect(state.translateY).toBe(0);
    expect(state.scaleX).toBe(1);
    expect(state.scaleY).toBe(1);
    expect(state.rotate).toBe(0);
    expect(state.opacity).toBe(1);
  });

  it("returns default state before animation starts", () => {
    const anim: LayerAnimation = { type: "blink", startTime: 2, duration: 1, repeat: false, intensity: 1 };
    const state = computeLayerState(1, [anim], 360);
    expect(state.scaleY).toBe(1); // not yet started
  });

  it("returns default state after non-repeating animation ends", () => {
    const anim: LayerAnimation = { type: "move-right", startTime: 0, duration: 1, repeat: false, intensity: 1 };
    const state = computeLayerState(2, [anim], 360); // t=2 > duration=1
    expect(state.translateX).toBe(0); // animation done, no effect
  });

  it("blink reduces scaleY during animation", () => {
    const anim: LayerAnimation = { type: "blink", startTime: 0, duration: 1, repeat: false, intensity: 1 };
    // At t=0.05 (5% through), scaleY should be reduced (eye closing)
    const state = computeLayerState(0.05, [anim], 360);
    expect(state.scaleY).toBeLessThan(1);
  });

  it("move-right increases translateX", () => {
    const anim: LayerAnimation = { type: "move-right", startTime: 0, duration: 2, repeat: false, intensity: 1 };
    const state = computeLayerState(1, [anim], 360);
    expect(state.translateX).toBeGreaterThan(0);
  });

  it("move-left decreases translateX", () => {
    const anim: LayerAnimation = { type: "move-left", startTime: 0, duration: 2, repeat: false, intensity: 1 };
    const state = computeLayerState(1, [anim], 360);
    expect(state.translateX).toBeLessThan(0);
  });

  it("fade-in increases opacity over time", () => {
    const anim: LayerAnimation = { type: "fade-in", startTime: 0, duration: 2, repeat: false, intensity: 1 };
    const state0 = computeLayerState(0.01, [anim], 360);
    const state1 = computeLayerState(1, [anim], 360);
    expect(state1.opacity).toBeGreaterThan(state0.opacity);
  });

  it("fat-thin changes scaleX", () => {
    const anim: LayerAnimation = { type: "fat-thin", startTime: 0, duration: 2, repeat: true, intensity: 1 };
    const state = computeLayerState(0.5, [anim], 360);
    expect(state.scaleX).not.toBe(1); // should be different from default
  });

  it("laugh adds translateX shake", () => {
    const anim: LayerAnimation = { type: "laugh", startTime: 0, duration: 2, repeat: true, intensity: 1 };
    const state = computeLayerState(0.1, [anim], 360);
    // At least one of the transforms should be non-default
    const hasEffect = state.translateX !== 0 || state.translateY !== 0 || state.scaleX !== 1;
    expect(hasEffect).toBe(true);
  });

  it("stateToTransform produces a valid CSS string", () => {
    const state = computeLayerState(0, [], 360);
    const transform = stateToTransform(state);
    expect(transform).toContain("translateX");
    expect(transform).toContain("scaleX");
    expect(transform).toContain("rotate");
  });

  it("ANIMATION_CATALOG has all expected animation types", () => {
    const types = ANIMATION_CATALOG.map(a => a.type);
    expect(types).toContain("blink");
    expect(types).toContain("wink-left");
    expect(types).toContain("wave-hand");
    expect(types).toContain("laugh");
    expect(types).toContain("fat-thin");
    expect(types).toContain("ear-scale");
    expect(types).toContain("hair-fly");
    expect(types).toContain("sit-down");
    expect(types).toContain("get-up");
    expect(types).toContain("walk");
    expect(types).toContain("run");
    expect(types).toContain("crawl");
    expect(types).toContain("hug");
    expect(types).toContain("kiss");
    expect(types).toContain("eye-wander");
  });

  it("ANIMATION_CATALOG has categories", () => {
    const categories = new Set(ANIMATION_CATALOG.map(a => a.category));
    expect(categories.has("Eyes")).toBe(true);
    expect(categories.has("Movement")).toBe(true);
    expect(categories.has("Expressions")).toBe(true);
    expect(categories.has("Body")).toBe(true);
    expect(categories.has("Gestures")).toBe(true);
  });

  it("multiple animations combine correctly", () => {
    const anims: LayerAnimation[] = [
      { type: "move-right", startTime: 0, duration: 2, repeat: false, intensity: 0.5 },
      { type: "bounce", startTime: 0, duration: 2, repeat: true, intensity: 0.5 },
    ];
    const state = computeLayerState(1, anims, 360);
    expect(state.translateX).toBeGreaterThan(0); // move-right
    // bounce affects translateY
  });
});
