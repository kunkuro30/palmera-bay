// localStorage persistence: cash earned and jobs finished survive a reload.
// Storage can be unavailable (private windows) — failures are swallowed and
// the save then lasts only for the visit.

const KEY = 'palmera-bay-reborn.save';

export function loadSave() {
  const save = { cash: 0, jobsDone: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Number.isFinite(parsed.cash)) save.cash = parsed.cash;
      if (Number.isFinite(parsed.jobsDone)) save.jobsDone = parsed.jobsDone;
    }
  } catch { /* keep defaults */ }
  return save;
}

export function persistSave(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ cash: save.cash, jobsDone: save.jobsDone }));
  } catch { /* visit-only save */ }
}
