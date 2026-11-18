// The save file: cash, story progress, found cases and taxi count, kept in localStorage
// under one key. Loading is forgiving — a missing or broken save just starts fresh.
import { SAVE_KEY, START_CASH } from './config.js';

export function defaultSave() {
  return { cash: START_CASH, storyStage: 0, casesFound: [], taxiDone: 0 };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const save = defaultSave();
    if (Number.isFinite(data.cash)) save.cash = Math.max(0, Math.floor(data.cash));
    if (Number.isInteger(data.storyStage)) save.storyStage = Math.min(4, Math.max(0, data.storyStage));
    if (Array.isArray(data.casesFound)) save.casesFound = data.casesFound.filter((n) => Number.isInteger(n));
    if (Number.isInteger(data.taxiDone)) save.taxiDone = Math.max(0, data.taxiDone);
    return save;
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
