"use client";
import { useSyncExternalStore } from "react";

// One record per user. Today the only user is "local"; with accounts, swap the storage
// backend for an API and key by user id. The shape stays the same.
export interface ProgressState {
  version: 1;
  completed: Record<string, number>; // lesson slug -> completed at (ms)
  bookmarks: Record<string, number>; // lesson or project key -> saved at
  quiz: Record<string, { score: number; total: number; at: number; best: number }>;
  projects: Record<string, { steps: number[]; startedAt: number; doneAt?: number }>;
  history: { slug: string; at: number }[]; // most recent first, capped
}

const KEY = "academy:v1:user:local";
const EMPTY: ProgressState = { version: 1, completed: {}, bookmarks: {}, quiz: {}, projects: {}, history: [] };

let state: ProgressState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Private mode / blocked storage: progress just won't persist.
  }
}

function set(next: ProgressState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      l();
    }
  };
  window.addEventListener("storage", onStorage); // keep tabs in sync
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProgress() {
  const s = useSyncExternalStore(subscribe, () => (load(), state), () => EMPTY);
  // True after hydration: lets UI avoid flashing "0%" before storage is read.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ...s, ready };
}

const toggle = (rec: Record<string, number>, k: string) => {
  const next = { ...rec };
  if (next[k]) delete next[k];
  else next[k] = Date.now();
  return next;
};

export const progress = {
  toggleComplete(slug: string) {
    set({ ...state, completed: toggle(state.completed, slug) });
  },
  markComplete(slug: string) {
    if (!state.completed[slug]) set({ ...state, completed: { ...state.completed, [slug]: Date.now() } });
  },
  toggleBookmark(key: string) {
    set({ ...state, bookmarks: toggle(state.bookmarks, key) });
  },
  saveQuiz(slug: string, score: number, total: number) {
    const best = Math.max(score, state.quiz[slug]?.best ?? 0);
    set({ ...state, quiz: { ...state.quiz, [slug]: { score, total, at: Date.now(), best } } });
  },
  toggleProjectStep(slug: string, step: number, totalSteps: number) {
    const cur = state.projects[slug] ?? { steps: [], startedAt: Date.now() };
    const steps = cur.steps.includes(step) ? cur.steps.filter((s) => s !== step) : [...cur.steps, step];
    const doneAt = steps.length === totalSteps ? Date.now() : undefined;
    set({ ...state, projects: { ...state.projects, [slug]: { ...cur, steps, doneAt } } });
  },
  visit(slug: string) {
    const history = [{ slug, at: Date.now() }, ...state.history.filter((h) => h.slug !== slug)].slice(0, 30);
    set({ ...state, history });
  },
  reset() {
    set(EMPTY);
  },
  export() {
    return JSON.stringify(state, null, 2);
  },
  import(json: string) {
    const parsed = JSON.parse(json);
    if (parsed?.version !== 1) throw new Error("Not a progress file from this site");
    set({ ...EMPTY, ...parsed });
  },
};
