import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

/** Simple form state with field-level error clearing. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const set = <K extends keyof T>(k: K, v: T[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));
  };
  return { values, setValues, errors, setErrors, set, reset: () => { setValues(initial); setErrors({}); } };
}

/** Read and write a single query-string param (keeps filters shareable/refresh-safe). */
export function useQueryParam(name: string): [string | null, (v: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(name);
  return useMemo(() => [value, (v: string | null) => {
    setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(name, v); else n.delete(name); return n; }, { replace: true });
  }], [value, name, setParams]);
}

export function useDocumentTitle(title: string) {
  useEffect(() => { document.title = `${title} · Meraki Hostel Management`; }, [title]);
}
