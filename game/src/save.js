// save.js — the whole persistent state of a Palmera Bay run, in localStorage.

const KEY = 'palmera-bay.save.v1';

export function defaultSave() {
  return { money: 120, nextMission: 0, collectibles: [], taxiFares: 0, playSeconds: 0 };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable (private mode etc.) — the run simply does not persist
  }
}
