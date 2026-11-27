import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Area, Bands, ConfigChecklists, ConfigMain, Contractor, Observation, SubArea } from '@/types';

/**
 * Admin edits to setup data run in transactions so they never overwrite a change made at the
 * same time by a Cloud Function (for example a new user added to the people directory).
 * Transactions need a connection; setup is done online.
 */
function requireOnline() {
  if (!navigator.onLine) throw new Error('You are offline. Setup changes need a connection.');
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'item';

/** Readable, collision-free id: "kiln-3", "kiln-3-2"… */
export function uniqueId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slug(name);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

const mainRef = () => doc(db, 'config', 'main');
const listsRef = () => doc(db, 'config', 'checklists');

/** Applies a change to config/main inside a transaction. */
export async function mutateMain(change: (c: ConfigMain) => Partial<ConfigMain>): Promise<void> {
  requireOnline();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(mainRef());
    if (!snap.exists()) throw new Error('Plant setup has not been imported yet.');
    const data = snap.data() as ConfigMain;
    tx.update(mainRef(), { ...change(data), updatedAt: serverTimestamp() });
  });
}

export function updateSubArea(subAreaId: string, patch: Partial<Omit<SubArea, 'id'>>): Promise<void> {
  return mutateMain((c) => {
    const idx = c.subAreas.findIndex((s) => s.id === subAreaId);
    if (idx < 0) throw new Error('Sub-area no longer exists.');
    const subAreas = [...c.subAreas];
    subAreas[idx] = { ...subAreas[idx], ...patch };
    return { subAreas };
  });
}

export function addArea(name: string): Promise<void> {
  return mutateMain((c) => {
    const n = name.trim();
    if (c.areas.some((a) => a.name.toLowerCase() === n.toLowerCase())) throw new Error('An area with this name already exists.');
    const area: Area = { id: uniqueId(n, c.areas.map((a) => a.id)), name: n, order: Math.max(0, ...c.areas.map((a) => a.order)) + 1, active: true };
    return { areas: [...c.areas, area] };
  });
}

export function updateArea(areaId: string, patch: Partial<Omit<Area, 'id'>>): Promise<void> {
  return mutateMain((c) => ({ areas: c.areas.map((a) => (a.id === areaId ? { ...a, ...patch } : a)) }));
}

/** Moves an area or sub-area one place up or down among its siblings. */
export function moveArea(areaId: string, dir: -1 | 1): Promise<void> {
  return mutateMain((c) => {
    const sorted = [...c.areas].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((a) => a.id === areaId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return {};
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    return { areas: sorted.map((a, k) => ({ ...a, order: k + 1 })) };
  });
}

/** Creates a sub-area and its (empty) observation list. Returns the new id. */
export async function addSubArea(areaId: string, name: string): Promise<string> {
  requireOnline();
  let id = '';
  await runTransaction(db, async (tx) => {
    const [m, l] = await Promise.all([tx.get(mainRef()), tx.get(listsRef())]);
    if (!m.exists()) throw new Error('Plant setup has not been imported yet.');
    const c = m.data() as ConfigMain;
    const n = name.trim();
    if (c.subAreas.some((s) => s.areaId === areaId && s.name.toLowerCase() === n.toLowerCase())) throw new Error('This area already has a sub-area with this name.');
    id = uniqueId(n, c.subAreas.map((s) => s.id));
    const sub: SubArea = {
      id,
      areaId,
      name: n,
      order: Math.max(0, ...c.subAreas.map((s) => s.order)) + 1,
      ownerIds: [],
      managerIds: [],
      contractors: [],
      active: true,
    };
    tx.update(mainRef(), { subAreas: [...c.subAreas, sub], updatedAt: serverTimestamp() });
    const lists = (l.exists() ? (l.data() as ConfigChecklists).lists : {}) ?? {};
    tx.set(listsRef(), { lists: { ...lists, [id]: lists[id] ?? [] }, updatedAt: serverTimestamp() }, { merge: true });
  });
  return id;
}

/** Copies another sub-area's observations as the starting list (e.g. Kiln 1 → Kiln 3). */
export async function copyObservations(fromSubAreaId: string, toSubAreaId: string): Promise<void> {
  await saveObservations(toSubAreaId, (_current, all) =>
    (all[fromSubAreaId] ?? []).filter((o) => o.active).map((o, i) => ({ ...o, order: i + 1 })),
  );
}

/**
 * Replaces one sub-area's observation list. Removed observations stay in the list as inactive so ids
 * are never reused; audits already submitted keep their own copy of the text.
 */
export async function saveObservations(
  subAreaId: string,
  next: (current: Observation[], all: Record<string, Observation[]>) => Observation[],
): Promise<void> {
  requireOnline();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(listsRef());
    const lists = (snap.exists() ? (snap.data() as ConfigChecklists).lists : {}) ?? {};
    const current = lists[subAreaId] ?? [];
    const updated = next(current, lists);
    const keep = new Set(updated.map((o) => o.id));
    const retired = current.filter((o) => !keep.has(o.id)).map((o) => ({ ...o, active: false }));
    tx.set(listsRef(), { lists: { ...lists, [subAreaId]: [...updated, ...retired] }, updatedAt: serverTimestamp() }, { merge: true });
  });
}

/** Next free observation id for a sub-area: o01, o02… (never reused). */
export function nextObservationId(existing: Observation[]): string {
  const max = existing.reduce((m, o) => Math.max(m, Number(o.id.replace(/\D/g, '')) || 0), 0);
  return `o${String(max + 1).padStart(2, '0')}`;
}

export function addContractor(name: string): Promise<void> {
  return mutateMain((c) => {
    const n = name.trim();
    if (c.contractors.some((x) => x.name.toLowerCase() === n.toLowerCase())) throw new Error('This contractor already exists.');
    const item: Contractor = { id: uniqueId(n, c.contractors.map((x) => x.id)), name: n, active: true };
    return { contractors: [...c.contractors, item].sort((a, b) => a.name.localeCompare(b.name)) };
  });
}

export function updateContractor(id: string, patch: Partial<Omit<Contractor, 'id'>>): Promise<void> {
  return mutateMain((c) => ({
    contractors: c.contractors.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function updateBands(bands: Bands): Promise<void> {
  if (!(bands.green > bands.amber && bands.amber > 0 && bands.green <= 100)) {
    return Promise.reject(new Error('Green must be above amber, and both between 1 and 100.'));
  }
  return mutateMain(() => ({ bands }));
}
