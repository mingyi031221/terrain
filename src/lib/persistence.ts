import { z } from 'zod';
import { TerrainMapSchema, type TerrainMap } from '../types';

const STORAGE_KEY = 'terrain:session:v1';

const PersistedSchema = z.object({
  version: z.literal(1),
  topic: z.string().min(1),
  map: TerrainMapSchema,
  completedNodeIds: z.array(z.string().min(1)),
});

export interface PersistedSession {
  topic: string;
  map: TerrainMap;
  completedNodeIds: string[];
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const payload = JSON.stringify({ version: 1, ...session });
    storage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore quota / serialization failure — persistence is best-effort
  }
}

export function loadSession(): PersistedSession | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }

  const result = PersistedSchema.safeParse(parsed);
  if (!result.success) {
    clearSession();
    return null;
  }

  return {
    topic: result.data.topic,
    map: result.data.map,
    completedNodeIds: result.data.completedNodeIds,
  };
}

export function clearSession(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const __STORAGE_KEY = STORAGE_KEY;
