/**
 * Comic Animator - Animation Engine
 * Computes CSS transform/filter/opacity values for each animation type
 * at a given time t (seconds from panel start).
 */

export type AnimationType =
  | "blink" | "wink-left" | "wink-right"
  | "eye-look-left" | "eye-look-right" | "eye-look-up" | "eye-look-down" | "eye-wander"
  | "wave-hand"
  | "hug"
  | "kiss"
  | "laugh"
  | "fat-thin"
  | "ear-scale"
  | "hair-fly"
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
  intensity: number; // 0-1
}

export interface AnimationState {
  translateX: number;  // px
  translateY: number;  // px
  scaleX: number;
  scaleY: number;
  rotate: number;      // degrees
  opacity: number;
  skewX: number;
  skewY: number;
}

const DEFAULT_STATE: AnimationState = {
  translateX: 0, translateY: 0,
  scaleX: 1, scaleY: 1,
  rotate: 0, opacity: 1,
  skewX: 0, skewY: 0,
};

/** Easing functions */
const ease = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  bounce: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },
  elastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3);
  },
};

/** Periodic oscillation: returns value between -1 and 1 */
function oscillate(t: number, freq = 1): number {
  return Math.sin(t * Math.PI * 2 * freq);
}

/** Compute local time within an animation (handles repeat) */
function localTime(globalT: number, anim: LayerAnimation): number | null {
  const elapsed = globalT - anim.startTime;
  if (elapsed < 0) return null;
  if (!anim.repeat && elapsed > anim.duration) return null;
  return anim.repeat ? (elapsed % anim.duration) / anim.duration : elapsed / anim.duration;
}

/** Compute the animation state for a single animation at time t */
function computeAnimation(t: number, anim: LayerAnimation, canvasWidth: number): Partial<AnimationState> {
  const lt = localTime(t, anim);
  if (lt === null) return {};
  const i = anim.intensity;

  switch (anim.type) {
    case "blink": {
      // Quick close/open: 0-0.1 close, 0.1-0.2 open
      const cycle = lt % 1;
      const scaleY = cycle < 0.1 ? 1 - cycle * 10 : cycle < 0.2 ? (cycle - 0.1) * 10 : 1;
      return { scaleY: Math.max(0.05, scaleY) };
    }
    case "wink-left": {
      const cycle = lt % 1;
      const scaleY = cycle < 0.15 ? 1 - cycle * 6.67 : cycle < 0.3 ? (cycle - 0.15) * 6.67 : 1;
      return { scaleY: Math.max(0.05, scaleY), translateX: -5 * i };
    }
    case "wink-right": {
      const cycle = lt % 1;
      const scaleY = cycle < 0.15 ? 1 - cycle * 6.67 : cycle < 0.3 ? (cycle - 0.15) * 6.67 : 1;
      return { scaleY: Math.max(0.05, scaleY), translateX: 5 * i };
    }
    case "eye-look-left":
      return { translateX: -8 * i * Math.sin(lt * Math.PI) };
    case "eye-look-right":
      return { translateX: 8 * i * Math.sin(lt * Math.PI) };
    case "eye-look-up":
      return { translateY: -6 * i * Math.sin(lt * Math.PI) };
    case "eye-look-down":
      return { translateY: 6 * i * Math.sin(lt * Math.PI) };
    case "eye-wander": {
      const angle = lt * Math.PI * 4;
      return {
        translateX: 8 * i * Math.cos(angle),
        translateY: 5 * i * Math.sin(angle * 0.7),
      };
    }
    case "wave-hand": {
      const angle = oscillate(lt, 3) * 25 * i;
      return { rotate: angle, translateY: -5 * i * Math.abs(Math.sin(lt * Math.PI * 3)) };
    }
    case "hug": {
      const progress = ease.easeInOut(lt);
      return {
        scaleX: 1 + 0.15 * i * Math.sin(progress * Math.PI),
        scaleY: 1 - 0.08 * i * Math.sin(progress * Math.PI),
        translateY: -10 * i * Math.sin(progress * Math.PI),
      };
    }
    case "kiss": {
      const progress = ease.easeInOut(lt);
      return {
        scaleX: 1 + 0.1 * i * Math.sin(progress * Math.PI * 2),
        translateY: -15 * i * ease.easeOut(lt < 0.5 ? lt * 2 : (1 - lt) * 2),
        rotate: oscillate(lt, 1) * 5 * i,
      };
    }
    case "laugh": {
      const shake = oscillate(lt, 8) * 6 * i;
      const bounce = Math.abs(oscillate(lt, 4)) * 8 * i;
      return {
        translateX: shake,
        translateY: -bounce,
        scaleX: 1 + 0.05 * i * Math.abs(oscillate(lt, 4)),
        scaleY: 1 - 0.05 * i * Math.abs(oscillate(lt, 4)),
      };
    }
    case "fat-thin": {
      // Oscillate between fat (wide) and thin (narrow)
      const cycle = Math.sin(lt * Math.PI * 2);
      return {
        scaleX: 1 + 0.4 * i * cycle,
        scaleY: 1 - 0.2 * i * cycle,
      };
    }
    case "ear-scale": {
      const cycle = Math.abs(Math.sin(lt * Math.PI * 2));
      return {
        scaleX: 1 + 0.5 * i * cycle,
        scaleY: 1 + 0.5 * i * cycle,
      };
    }
    case "hair-fly": {
      const sway = oscillate(lt, 2.5) * 8 * i;
      const lift = Math.abs(oscillate(lt, 2.5)) * 4 * i;
      return {
        skewX: sway * 0.5,
        translateX: sway,
        translateY: -lift,
      };
    }
    case "sit-down": {
      const progress = ease.easeInOut(Math.min(lt, 1));
      return {
        translateY: 30 * i * progress,
        scaleY: 1 - 0.3 * i * progress,
        scaleX: 1 + 0.15 * i * progress,
      };
    }
    case "get-up": {
      const progress = ease.easeOut(Math.min(lt, 1));
      return {
        translateY: 30 * i * (1 - progress),
        scaleY: 1 - 0.3 * i * (1 - progress),
        scaleX: 1 + 0.15 * i * (1 - progress),
      };
    }
    case "walk": {
      const step = oscillate(lt, 2) * 5 * i;
      const bob = Math.abs(oscillate(lt, 2)) * 3 * i;
      const travel = lt * canvasWidth * 0.3 * i;
      return {
        translateX: travel,
        translateY: -bob,
        rotate: step * 0.5,
        scaleX: 1 + 0.02 * i * Math.abs(oscillate(lt, 2)),
      };
    }
    case "run": {
      const step = oscillate(lt, 4) * 8 * i;
      const bob = Math.abs(oscillate(lt, 4)) * 6 * i;
      const travel = lt * canvasWidth * 0.6 * i;
      return {
        translateX: travel,
        translateY: -bob,
        rotate: step * 0.8,
        scaleX: 1 + 0.04 * i * Math.abs(oscillate(lt, 4)),
      };
    }
    case "crawl": {
      const step = oscillate(lt, 2) * 4 * i;
      const travel = lt * canvasWidth * 0.2 * i;
      return {
        translateX: travel,
        translateY: 20 * i,
        rotate: step * 0.3,
        scaleY: 0.7 + 0.05 * i * Math.abs(oscillate(lt, 2)),
      };
    }
    case "move-left": {
      const travel = lt * canvasWidth * 0.5 * i;
      return { translateX: -travel };
    }
    case "move-right": {
      const travel = lt * canvasWidth * 0.5 * i;
      return { translateX: travel };
    }
    case "bounce": {
      const b = ease.bounce(lt % 1);
      return { translateY: -30 * i * (1 - b) };
    }
    case "shake": {
      return { translateX: oscillate(lt, 10) * 10 * i };
    }
    case "spin": {
      return { rotate: lt * 360 * i };
    }
    case "fade-in": {
      return { opacity: ease.easeIn(lt) };
    }
    case "fade-out": {
      return { opacity: 1 - ease.easeOut(lt) };
    }
    case "zoom-in": {
      const s = 0.5 + 0.5 * ease.easeOut(lt);
      return { scaleX: s * (1 + (1 - s) * i), scaleY: s * (1 + (1 - s) * i) };
    }
    case "zoom-out": {
      const s = 1 + 0.5 * ease.easeIn(lt) * i;
      return { scaleX: s, scaleY: s };
    }
    case "float": {
      return { translateY: oscillate(lt, 0.5) * 8 * i };
    }
    default:
      return {};
  }
}

/** Merge multiple animation states by adding transforms */
function mergeStates(base: AnimationState, delta: Partial<AnimationState>): AnimationState {
  return {
    translateX: base.translateX + (delta.translateX ?? 0),
    translateY: base.translateY + (delta.translateY ?? 0),
    scaleX: base.scaleX * (delta.scaleX ?? 1),
    scaleY: base.scaleY * (delta.scaleY ?? 1),
    rotate: base.rotate + (delta.rotate ?? 0),
    opacity: base.opacity * (delta.opacity ?? 1),
    skewX: base.skewX + (delta.skewX ?? 0),
    skewY: base.skewY + (delta.skewY ?? 0),
  };
}

/** Compute the combined animation state for a layer at time t */
export function computeLayerState(
  t: number,
  animations: LayerAnimation[],
  canvasWidth: number,
): AnimationState {
  let state = { ...DEFAULT_STATE };
  for (const anim of animations) {
    const delta = computeAnimation(t, anim, canvasWidth);
    state = mergeStates(state, delta);
  }
  return state;
}

/** Convert animation state to CSS transform string */
export function stateToTransform(state: AnimationState): string {
  return [
    `translateX(${state.translateX.toFixed(2)}px)`,
    `translateY(${state.translateY.toFixed(2)}px)`,
    `scaleX(${state.scaleX.toFixed(4)})`,
    `scaleY(${state.scaleY.toFixed(4)})`,
    `rotate(${state.rotate.toFixed(2)}deg)`,
    `skewX(${state.skewX.toFixed(2)}deg)`,
    `skewY(${state.skewY.toFixed(2)}deg)`,
  ].join(' ');
}

/** All available animation types with labels */
export const ANIMATION_CATALOG: { type: AnimationType; label: string; category: string }[] = [
  { type: "blink", label: "Blink", category: "Eyes" },
  { type: "wink-left", label: "Wink Left", category: "Eyes" },
  { type: "wink-right", label: "Wink Right", category: "Eyes" },
  { type: "eye-look-left", label: "Look Left", category: "Eyes" },
  { type: "eye-look-right", label: "Look Right", category: "Eyes" },
  { type: "eye-look-up", label: "Look Up", category: "Eyes" },
  { type: "eye-look-down", label: "Look Down", category: "Eyes" },
  { type: "eye-wander", label: "Eye Wander", category: "Eyes" },
  { type: "wave-hand", label: "Wave Hand", category: "Gestures" },
  { type: "hug", label: "Hug", category: "Gestures" },
  { type: "kiss", label: "Kiss", category: "Gestures" },
  { type: "laugh", label: "Laugh", category: "Expressions" },
  { type: "fat-thin", label: "Fat/Thin Illusion", category: "Body" },
  { type: "ear-scale", label: "Ear Scale", category: "Body" },
  { type: "hair-fly", label: "Hair Fly", category: "Body" },
  { type: "sit-down", label: "Sit Down", category: "Movement" },
  { type: "get-up", label: "Get Up", category: "Movement" },
  { type: "walk", label: "Walk", category: "Movement" },
  { type: "run", label: "Run", category: "Movement" },
  { type: "crawl", label: "Crawl", category: "Movement" },
  { type: "move-left", label: "Move Left", category: "Movement" },
  { type: "move-right", label: "Move Right", category: "Movement" },
  { type: "bounce", label: "Bounce", category: "Effects" },
  { type: "shake", label: "Shake", category: "Effects" },
  { type: "spin", label: "Spin", category: "Effects" },
  { type: "float", label: "Float", category: "Effects" },
  { type: "fade-in", label: "Fade In", category: "Transitions" },
  { type: "fade-out", label: "Fade Out", category: "Transitions" },
  { type: "zoom-in", label: "Zoom In", category: "Transitions" },
  { type: "zoom-out", label: "Zoom Out", category: "Transitions" },
];
