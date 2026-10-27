// Application state: one shared store, persisted to the server (/api/state) with a browser fallback.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialState, computeDerived } from './engine.js';

export const Store = createContext(null);
export const useStore = () => useContext(Store);

const LOCAL_KEY = 'stis-state-v1';
const PROJECT = 'default';
const STATE_VERSION = 1;

/**
 * Returns [state, setState, persistMode]. persistMode is 'server' when the API accepted the
 * last load, otherwise 'local'. Writes are debounced and never overlap.
 */
export function usePersistentState() {
  const [S, setS] = useState(initialState);
  const [persist, setPersist] = useState('local');
  const ready = useRef(false);
  const serverOk = useRef(false);
  const inFlight = useRef(false);
  const queued = useRef(null);

  useEffect(() => {
    let alive = true;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) { const v = JSON.parse(raw); if (v && v.v === STATE_VERSION) setS((s) => ({ ...s, ...v })); }
    } catch { /* storage unavailable */ }
    fetch(`/api/state/${PROJECT}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 204) { serverOk.current = true; setPersist('server'); return; }
        if (!r.ok) return;
        const v = await r.json();
        if (v && v.v === STATE_VERSION) setS((s) => ({ ...s, ...v }));
        serverOk.current = true; setPersist('server');
      })
      .catch(() => { /* offline: browser storage only */ })
      .finally(() => { ready.current = true; });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    const body = JSON.stringify({ ...S, audit: S.audit.slice(0, 250) });
    try { localStorage.setItem(LOCAL_KEY, body); } catch { /* quota or disabled */ }
    if (!serverOk.current) return;
    queued.current = body;
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
    async function flush() {
      if (inFlight.current || queued.current == null) return;
      inFlight.current = true;
      const payload = queued.current; queued.current = null;
      try {
        const r = await fetch(`/api/state/${PROJECT}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: payload });
        if (!r.ok) setPersist('local');
      } catch { setPersist('local'); }
      inFlight.current = false;
      if (queued.current != null) flush();
    }
  }, [S]);

  return [S, setS, persist];
}

export function useDerived(S) {
  return useMemo(() => computeDerived(S), [S]);
}
