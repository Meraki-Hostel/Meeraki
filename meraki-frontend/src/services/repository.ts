import type { DemoState } from '@/types/domain';
import { buildSeed } from '@/data/fixtures/seed';

/**
 * The ONLY module that touches localStorage. Mock services read/write through
 * this repository; pages and components never import it directly.
 */
export const STORAGE_KEY = 'meraki-demo-v1';
export const SCHEMA_VERSION = 1;

interface Envelope { schemaVersion: number; savedAt: string; state: DemoState }

type Listener = () => void;

function isValidState(s: unknown): s is DemoState {
  if (!s || typeof s !== 'object') return false;
  const seedKeys = Object.keys(buildSeed()) as Array<keyof DemoState>;
  const obj = s as Record<string, unknown>;
  return seedKeys.every((k) => k in obj && (k === 'session' || obj[k] !== undefined))
    && Array.isArray(obj.properties) && Array.isArray(obj.students) && Array.isArray(obj.beds);
}

function safeStorage(): Storage | null {
  try {
    const t = '__meraki_probe__';
    window.localStorage.setItem(t, t);
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    return null;
  }
}

class DemoRepository {
  private state: DemoState;
  private listeners = new Set<Listener>();
  private storage = safeStorage();
  /** Set when stored data was unreadable and the seed was restored. */
  recoveredFromCorruption = false;
  version = 0;

  constructor() {
    this.state = this.load();
  }

  private load(): DemoState {
    if (!this.storage) return buildSeed();
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return this.persistFresh();
    try {
      const env = JSON.parse(raw) as Partial<Envelope>;
      if (env.schemaVersion !== SCHEMA_VERSION || !isValidState(env.state)) throw new Error('schema mismatch');
      return env.state;
    } catch {
      this.recoveredFromCorruption = true;
      return this.persistFresh();
    }
  }

  private persistFresh(): DemoState {
    const seed = buildSeed();
    this.write(seed);
    return seed;
  }

  private write(state: DemoState) {
    if (!this.storage) return;
    const env: Envelope = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), state };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(env));
    } catch {
      /* Quota exceeded or private mode: keep working in memory. */
    }
  }

  /** Read-only view. Services must clone before handing data to the UI. */
  read(): Readonly<DemoState> {
    return this.state;
  }

  /** Apply a mutation, persist, and notify subscribers. */
  update(mutator: (draft: DemoState) => void): void {
    mutator(this.state);
    this.write(this.state);
    this.bump();
  }

  reset(): void {
    const session = this.state.session;
    this.state = buildSeed();
    this.state.session = session;
    this.write(this.state);
    this.bump();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private bump() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
}

export const repository = new DemoRepository();
