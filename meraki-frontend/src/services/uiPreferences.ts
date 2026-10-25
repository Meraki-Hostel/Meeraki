/**
 * Device-level UI preferences (not demo data, not reset by Reset Demo Data).
 * Kept beside the repository so localStorage access stays inside services/.
 */
const KEY = 'meraki-ui-v1';
interface UiPrefs { sidebarCollapsed: boolean }
const defaults: UiPrefs = { sidebarCollapsed: false };

export function getUiPrefs(): UiPrefs {
  try { return { ...defaults, ...(JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<UiPrefs>) }; } catch { return defaults; }
}
export function setUiPrefs(patch: Partial<UiPrefs>): void {
  try { window.localStorage.setItem(KEY, JSON.stringify({ ...getUiPrefs(), ...patch })); } catch { /* storage unavailable */ }
}
