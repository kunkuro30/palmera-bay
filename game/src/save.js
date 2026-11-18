// save.js — the player's long-term progress in localStorage: money, which
// story mission comes next, the collectible cases already found and the taxi
// fares banked. Nothing here is needed to boot; a corrupt save is a new game.

const KEY = 'palmera-bay.save.v1';

export function defaultSave() {
  return { money: 120, nextMission: 0, collectibles: [], taxiFares: 0, playSeconds: 0 };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    return { ...defaultSave(), ...data, collectibles: Array.isArray(data.collectibles) ? data.collectibles : [] };
  } catch {
    return defaultSave();
  }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private windows and full storage just mean the save lasts this visit.
  }
}
