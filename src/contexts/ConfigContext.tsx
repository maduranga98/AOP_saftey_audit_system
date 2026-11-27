import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_BANDS } from '@/lib/score';
import { useAuth } from './AuthContext';
import type { Area, ConfigChecklists, ConfigMain, Contractor, Observation, Person, SubArea } from '@/types';

interface ConfigState {
  config: ConfigMain | null;
  checklists: ConfigChecklists | null;
  loading: boolean;
  error: string | null;
  /** True when the data shown came from the device cache (no signal yet). */
  fromCache: boolean;
  areaById: Map<string, Area>;
  subAreaById: Map<string, SubArea>;
  contractorById: Map<string, Contractor>;
  personById: Map<string, Person>;
  sortedAreas: Area[];
  subAreasOf: (areaId: string) => SubArea[];
  observationsOf: (subAreaId: string) => Observation[];
}

const ConfigContext = createContext<ConfigState | null>(null);

const EMPTY: ConfigMain = { areas: [], subAreas: [], contractors: [], people: [], bands: DEFAULT_BANDS };

/**
 * All setup data lives in two documents. Each is read once per session (then kept live by the
 * listener and cached on the device), so setup data costs about 2 reads per app open.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { uid, roles } = useAuth();
  const [config, setConfig] = useState<ConfigMain | null>(null);
  const [checklists, setChecklists] = useState<ConfigChecklists | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const needsChecklists = roles.includes('auditor') || roles.includes('admin');

  useEffect(() => {
    if (!uid || roles.length === 0) {
      setConfig(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, 'config', 'main'),
      (snap) => {
        setConfig(snap.exists() ? ({ ...EMPTY, ...(snap.data() as Partial<ConfigMain>) } as ConfigMain) : EMPTY);
        setFromCache(snap.metadata.fromCache);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [uid, roles.length]);

  useEffect(() => {
    if (!uid || !needsChecklists) {
      setChecklists(null);
      return;
    }
    return onSnapshot(
      doc(db, 'config', 'checklists'),
      (snap) => setChecklists(snap.exists() ? (snap.data() as ConfigChecklists) : { lists: {} }),
      (err) => setError(err.message),
    );
  }, [uid, needsChecklists]);

  const value = useMemo<ConfigState>(() => {
    const c = config ?? EMPTY;
    const sortedAreas = [...c.areas].sort((a, b) => a.order - b.order);
    const bySubArea = new Map<string, SubArea[]>();
    for (const s of [...c.subAreas].sort((a, b) => a.order - b.order)) {
      if (!bySubArea.has(s.areaId)) bySubArea.set(s.areaId, []);
      bySubArea.get(s.areaId)!.push(s);
    }
    return {
      config,
      checklists,
      loading,
      error,
      fromCache,
      areaById: new Map(c.areas.map((a) => [a.id, a])),
      subAreaById: new Map(c.subAreas.map((s) => [s.id, s])),
      contractorById: new Map(c.contractors.map((x) => [x.id, x])),
      personById: new Map(c.people.map((p) => [p.uid, p])),
      sortedAreas,
      subAreasOf: (areaId) => bySubArea.get(areaId) ?? [],
      observationsOf: (subAreaId) =>
        [...(checklists?.lists[subAreaId] ?? [])].filter((o) => o.active).sort((a, b) => a.order - b.order),
    };
  }, [config, checklists, loading, error, fromCache]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigState {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used inside ConfigProvider');
  return ctx;
}
