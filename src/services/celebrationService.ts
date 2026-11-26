/**
 * TeqqnoWorld Centralized Luxury Celebration & Sound Effects Service
 * ------------------------------------------------------------------
 * Single reusable controller for website-wide confetti bursts and optional
 * Web Audio API luxury sound chimes.
 *
 * Design guarantees:
 * - Zero external copyrighted audio dependencies (pure harmonic Web Audio synthesis).
 * - Never auto-plays sound on initial page load.
 * - Gracefully handles browser autoplay restrictions without throwing errors.
 * - Animation ALWAYS dispatches even when sound is muted or blocked.
 * - Strict eventKey deduplication + optional localStorage one-time persistence
 *   prevents double triggers from repeated API calls or React re-renders.
 */

export type CelebrationLevel = 'subtle' | 'premium' | 'grand';

export type CelebrationSoundStyle = 'pop' | 'chime' | 'celebration' | 'grand' | 'none';

export interface CelebrationOrigin {
  /** Normalized horizontal viewport coordinate in [0, 1] */
  x: number;
  /** Normalized vertical viewport coordinate in [0, 1] */
  y: number;
}

export interface CelebrationTriggerOptions {
  /** Visual intensity: Level 1 ('subtle'), Level 2 ('premium'), Level 3 ('grand') */
  level: CelebrationLevel;
  /** Optional sound preset override; defaults smoothly from level */
  sound?: CelebrationSoundStyle;
  /** Explicit normalized origin { x: 0..1, y: 0..1 } */
  origin?: CelebrationOrigin;
  /** Optional DOM element to burst from (center of bounding rect) */
  originElement?: HTMLElement | null;
  /** Idempotency key to prevent duplicate triggers for the same success event */
  eventKey?: string;
  /** Deduplication window in ms for eventKey (default 8000ms) */
  dedupeWindowMs?: number;
  /** If true, remember eventKey in localStorage so milestone fires only once per browser */
  persistOnce?: boolean;
  /** Optional human-readable action tag for diagnostics/testing */
  action?: string;
}

export interface CelebrationEvent {
  id: string;
  level: CelebrationLevel;
  sound: CelebrationSoundStyle;
  origin: CelebrationOrigin;
  timestamp: number;
  eventKey?: string;
  action?: string;
}

export interface CelebrationSoundPrefs {
  enabled: boolean;
  /** Normalized volume in [0, 1] */
  volume: number;
}

export const SOUND_PREFS_STORAGE_KEY = 'teqqno_celebration_sound_prefs';
const PERSIST_ONCE_STORAGE_KEY = 'teqqno_celebration_once_keys';
const DEFAULT_DEDUPE_MS = 8000;
const POINTER_FRESHNESS_MS = 2600;
const RAPID_THROTTLE_MS = 180;

const LEVEL_WEIGHT: Record<CelebrationLevel, number> = {
  subtle: 1,
  premium: 2,
  grand: 3,
};

const DEFAULT_SOUND_BY_LEVEL: Record<CelebrationLevel, CelebrationSoundStyle> = {
  subtle: 'pop',
  premium: 'celebration',
  grand: 'grand',
};

type CelebrationListener = (event: CelebrationEvent) => void;
type SoundPrefsListener = (prefs: CelebrationSoundPrefs) => void;

const celebrationListeners = new Set<CelebrationListener>();
const soundPrefsListeners = new Set<SoundPrefsListener>();
const recentEventKeys = new Map<string, number>();

let lastTriggerTimestamp = 0;
let lastTriggerLevel: CelebrationLevel = 'subtle';
let lastPointer: { x: number; y: number; ts: number } | null = null;
let pointerTrackerAttached = false;
let sharedAudioContext: AudioContext | null = null;

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Storage restricted (private browsing / iframe sandbox)
  }
  return null;
}

function readPersistedSoundPrefs(): CelebrationSoundPrefs {
  const defaults: CelebrationSoundPrefs = { enabled: true, volume: 0.55 };
  const storage = getSafeStorage();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(SOUND_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : defaults.enabled,
      volume:
        typeof parsed?.volume === 'number' && Number.isFinite(parsed.volume)
          ? clamp(parsed.volume, 0, 1)
          : defaults.volume,
    };
  } catch {
    return defaults;
  }
}

let currentSoundPrefs: CelebrationSoundPrefs = readPersistedSoundPrefs();

function persistSoundPrefs(next: CelebrationSoundPrefs): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(SOUND_PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

function emitSoundPrefs(): void {
  const snapshot: CelebrationSoundPrefs = { ...currentSoundPrefs };
  soundPrefsListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // isolate subscriber errors
    }
  });
}

function hasPersistedOnceKey(eventKey: string): boolean {
  const storage = getSafeStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(PERSIST_ONCE_STORAGE_KEY);
    if (!raw) return false;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.includes(eventKey);
  } catch {
    return false;
  }
}

export function hasCelebrationPersisted(eventKey: string): boolean {
  if (!eventKey) return false;
  return hasPersistedOnceKey(eventKey);
}

function markPersistedOnceKey(eventKey: string): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(PERSIST_ONCE_STORAGE_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(arr) ? arr : [];
    if (!safeList.includes(eventKey)) {
      safeList.push(eventKey);
      // Keep bounded to last 120 milestone keys
      const trimmed = safeList.slice(-120);
      storage.setItem(PERSIST_ONCE_STORAGE_KEY, JSON.stringify(trimmed));
    }
  } catch {
    // ignore storage errors
  }
}

function attachPointerTracker(): void {
  if (pointerTrackerAttached || typeof window === 'undefined') return;
  pointerTrackerAttached = true;

  const recordPointer = (e: PointerEvent | MouseEvent) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    lastPointer = {
      x: clamp(e.clientX / w, 0.08, 0.92),
      y: clamp(e.clientY / h, 0.1, 0.88),
      ts: Date.now(),
    };
  };

  window.addEventListener('pointerdown', recordPointer, { passive: true, capture: true });
}

// Auto-initialize lightweight passive pointer coordinate tracker in browser
if (typeof window !== 'undefined') {
  attachPointerTracker();
}

function resolveOrigin(options: CelebrationTriggerOptions): CelebrationOrigin {
  if (options.origin) {
    return {
      x: clamp(options.origin.x, 0.06, 0.94),
      y: clamp(options.origin.y, 0.08, 0.92),
    };
  }

  if (options.originElement && typeof window !== 'undefined') {
    try {
      const rect = options.originElement.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        const cx = (rect.left + rect.width / 2) / (window.innerWidth || 1);
        const cy = (rect.top + rect.height / 2) / (window.innerHeight || 1);
        return {
          x: clamp(cx, 0.08, 0.92),
          y: clamp(cy, 0.1, 0.88),
        };
      }
    } catch {
      // ignore detached element errors
    }
  }

  // Grand celebrations look best centered-upper unless an explicit origin was supplied
  if (options.level === 'grand') {
    return { x: 0.5, y: 0.34 };
  }

  if (lastPointer && Date.now() - lastPointer.ts <= POINTER_FRESHNESS_MS) {
    return { x: lastPointer.x, y: lastPointer.y };
  }

  return { x: 0.5, y: 0.38 };
}

function getAudioContextConstructor(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

function getOrCreateAudioContext(): AudioContext | null {
  try {
    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return null;
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtx();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Pure Web Audio API harmonic synthesizer — short, warm, luxury tones.
 * Never produces harsh clicks, loud explosions, or firecracker sounds.
 */
function synthesizeLuxuryTone(
  ctx: AudioContext,
  style: Exclude<CelebrationSoundStyle, 'none'>,
  volume: number
): void {
  const now = ctx.currentTime + 0.008;
  // Perceptual volume curve kept refined and pleasant even at 100%
  const masterLevel = clamp(volume * volume * 0.24, 0.002, 0.26);

  const master = ctx.createGain();
  master.gain.setValueAtTime(masterLevel, now);
  master.connect(ctx.destination);

  const playNote = (
    freq: number,
    startOffset: number,
    duration: number,
    gainPeak: number,
    type: OscillatorType = 'sine',
    freqEnd?: number
  ) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + startOffset + duration * 0.7);
    }

    env.gain.setValueAtTime(0.0001, now + startOffset);
    env.gain.linearRampToValueAtTime(gainPeak, now + startOffset + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

    osc.connect(env);
    env.connect(master);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.03);
    osc.onended = () => {
      try {
        osc.disconnect();
        env.disconnect();
      } catch {
        // ignore cleanup errors
      }
    };
  };

  if (style === 'pop') {
    // Soft acoustic bubble pop + warm sparkle overtone (~180ms)
    playNote(520, 0, 0.095, 0.65, 'sine', 780);
    playNote(1046.5, 0.035, 0.17, 0.32, 'triangle');
    return;
  }

  if (style === 'chime') {
    // Delicate crystal bell chime (~360ms): E5 -> B5 -> E6
    playNote(659.25, 0, 0.22, 0.45, 'sine');
    playNote(987.77, 0.055, 0.26, 0.38, 'triangle');
    playNote(1318.51, 0.11, 0.3, 0.28, 'sine');
    return;
  }

  if (style === 'celebration') {
    // Level 2 Premium Celebration: soft pop + warm luxury Cmaj7 chime (~480ms)
    playNote(440, 0, 0.075, 0.42, 'sine', 660);
    playNote(523.25, 0.03, 0.28, 0.42, 'sine'); // C5
    playNote(659.25, 0.085, 0.3, 0.4, 'triangle'); // E5
    playNote(783.99, 0.14, 0.34, 0.38, 'sine'); // G5
    playNote(1046.5, 0.2, 0.38, 0.32, 'sine'); // C6
    playNote(1567.98, 0.24, 0.28, 0.14, 'sine'); // G6 subtle shimmer
    return;
  }

  // Level 3 Grand Milestone: prestigious ascending harp-chime arpeggio (~820ms)
  playNote(392.0, 0, 0.12, 0.32, 'sine', 523.25); // gentle warm swell
  const grandNotes: Array<[number, number, number, number, OscillatorType]> = [
    [523.25, 0.03, 0.42, 0.44, 'sine'], // C5
    [659.25, 0.095, 0.44, 0.4, 'triangle'], // E5
    [783.99, 0.16, 0.48, 0.4, 'sine'], // G5
    [987.77, 0.225, 0.5, 0.34, 'sine'], // B5
    [1046.5, 0.295, 0.56, 0.38, 'triangle'], // C6
    [1318.51, 0.37, 0.54, 0.26, 'sine'], // E6
    [1567.98, 0.44, 0.48, 0.2, 'sine'], // G6 shimmer
  ];
  for (const [freq, offset, dur, peak, wave] of grandNotes) {
    playNote(freq, offset, dur, peak, wave);
  }
}

export function playCelebrationSound(style: CelebrationSoundStyle): boolean {
  if (style === 'none') return false;
  if (!currentSoundPrefs.enabled || currentSoundPrefs.volume <= 0.005) return false;

  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      const resumeResult = ctx.resume();
      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult
          .then(() => {
            try {
              if (ctx.state === 'running') {
                synthesizeLuxuryTone(ctx, style, currentSoundPrefs.volume);
              }
            } catch {
              // ignore playback errors
            }
          })
          .catch(() => {
            // Browser blocked autoplay — degrade silently without breaking UI
          });
      }
      return true;
    }

    synthesizeLuxuryTone(ctx, style, currentSoundPrefs.volume);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a website-wide celebration animation (+ optional sound effect).
 * Returns the dispatched CelebrationEvent, or null if suppressed by deduplication.
 */
export function triggerCelebration(
  options: CelebrationTriggerOptions
): CelebrationEvent | null {
  const now = Date.now();
  const dedupeMs = options.dedupeWindowMs ?? DEFAULT_DEDUPE_MS;

  // 1. Check one-time persistent milestone lock (e.g., partner approved / reward unlocked)
  if (options.eventKey && options.persistOnce && hasPersistedOnceKey(options.eventKey)) {
    return null;
  }

  // 2. Check short-term idempotency deduplication map (prevents double API / re-render triggers)
  if (options.eventKey) {
    const prevTs = recentEventKeys.get(options.eventKey);
    if (prevTs !== undefined && now - prevTs < dedupeMs) {
      return null;
    }
    recentEventKeys.set(options.eventKey, now);
    if (recentEventKeys.size > 150) {
      for (const [k, ts] of recentEventKeys.entries()) {
        if (now - ts > 60_000) recentEventKeys.delete(k);
      }
    }
    if (options.persistOnce) {
      markPersistedOnceKey(options.eventKey);
    }
  }

  // 3. Global anti-overlap guard: allow higher intensity to preempt, throttle rapid duplicates
  if (
    now - lastTriggerTimestamp < RAPID_THROTTLE_MS &&
    LEVEL_WEIGHT[options.level] <= LEVEL_WEIGHT[lastTriggerLevel]
  ) {
    return null;
  }

  lastTriggerTimestamp = now;
  lastTriggerLevel = options.level;

  const sound: CelebrationSoundStyle =
    options.sound ?? DEFAULT_SOUND_BY_LEVEL[options.level];

  const event: CelebrationEvent = {
    id: `cel-${now}-${Math.random().toString(36).slice(2, 7)}`,
    level: options.level,
    sound,
    origin: resolveOrigin(options),
    timestamp: now,
    eventKey: options.eventKey,
    action: options.action,
  };

  // Emit visual animation FIRST so visual celebration ALWAYS runs regardless of audio state
  celebrationListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // isolate listener failures
    }
  });

  // Attempt optional luxury sound (silently ignored when muted or blocked)
  playCelebrationSound(sound);

  return event;
}

export function subscribeCelebrations(listener: CelebrationListener): () => void {
  celebrationListeners.add(listener);
  return () => {
    celebrationListeners.delete(listener);
  };
}

export function getCelebrationSoundPrefs(): CelebrationSoundPrefs {
  return { ...currentSoundPrefs };
}

export function setCelebrationSoundEnabled(enabled: boolean): CelebrationSoundPrefs {
  currentSoundPrefs = {
    ...currentSoundPrefs,
    enabled: Boolean(enabled),
  };
  persistSoundPrefs(currentSoundPrefs);
  emitSoundPrefs();
  return { ...currentSoundPrefs };
}

export function setCelebrationSoundVolume(volume: number): CelebrationSoundPrefs {
  currentSoundPrefs = {
    ...currentSoundPrefs,
    volume: clamp(volume, 0, 1),
  };
  persistSoundPrefs(currentSoundPrefs);
  emitSoundPrefs();
  return { ...currentSoundPrefs };
}

export function subscribeCelebrationSoundPrefs(listener: SoundPrefsListener): () => void {
  soundPrefsListeners.add(listener);
  return () => {
    soundPrefsListeners.delete(listener);
  };
}

/**
 * Reload prefs from storage & clear transient dedupe state (used by automated tests).
 */
export function resetCelebrationStateForTests(): void {
  recentEventKeys.clear();
  lastTriggerTimestamp = 0;
  lastTriggerLevel = 'subtle';
  lastPointer = null;
  sharedAudioContext = null;
  currentSoundPrefs = readPersistedSoundPrefs();
}
