/** Compares "1.2.3" versions. Missing or malformed parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export const mustUpdate = (current: string, minVersion: string) => compareVersions(current, minVersion) < 0;
export const canUpdate = (current: string, latestVersion: string) => compareVersions(current, latestVersion) < 0;
