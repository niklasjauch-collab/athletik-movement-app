// Client-side (localStorage) persistence for the latest generated
// Corrective Exercise plan per client, plus training sessions and their
// pre-/post-training questionnaires.
//
// Why localStorage and not Prisma, given schema.prisma already has
// TrainingSession/TrainingSessionExercise/SessionQuestionnaire models:
// this follows the same Phase 1 pattern as the rest of the app (see
// README) — DATABASE_URL isn't connected in this environment, so /scans,
// /exercises etc. all read seed JSON and keep state client-side rather
// than hitting a live database. Training/progress documentation is the
// one place that pattern doesn't quite work as-is (a plain useState
// wouldn't survive a page reload, and "progress over time" is meaningless
// without surviving reloads) — localStorage is the smallest change that
// makes the demo actually work across visits while staying consistent
// with "no live DB yet".
//
// The record shapes below intentionally mirror the Prisma model field
// names 1:1, so swapping this module's functions for real
// `prisma.trainingSession.*` calls behind a small API layer is a
// mechanical migration, not a redesign, once DATABASE_URL is wired up.
// See README "Training- & Fortschrittsdokumentation".

import type { CompensationKey, Phase } from "./corrective/rules";
import type { PlanItem, Side } from "./corrective/generatePlan";

const isBrowser = typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full/unavailable (private browsing etc.) — fail silently,
    // this is a Phase 1 convenience layer, not the system of record.
  }
}

export function newId(): string {
  if (isBrowser && "randomUUID" in window.crypto) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// --- Latest generated plan per client (bridges /scans -> /training) ---

export interface LatestPlanFinding {
  compensation: CompensationKey;
  side: Side;
}

export interface LatestPlanRecord {
  clientId: string;
  generatedAt: string; // ISO
  scanFileName?: string | null;
  findings: LatestPlanFinding[];
  items: PlanItem[];
}

function latestPlanKey(clientId: string) {
  return `movura.latestPlan.${clientId}`;
}

export function getLatestPlan(clientId: string): LatestPlanRecord | null {
  return read<LatestPlanRecord | null>(latestPlanKey(clientId), null);
}

export function saveLatestPlan(record: LatestPlanRecord): void {
  write(latestPlanKey(record.clientId), record);
}

// --- Training sessions (Trainings- & Fortschrittsdokumentation) ---

export type SessionStatus = "PLANNED" | "COMPLETED" | "SKIPPED";

export interface PreQuestionnaire {
  painLevel?: number | null; // 0-10
  painLocation?: string | null;
  energyLevel?: number | null; // 0-10
  sleepQuality?: number | null; // 0-10
  stressLevel?: number | null; // 0-10
  readyToTrain?: boolean | null;
  notes?: string | null;
}

export interface PostQuestionnaire {
  rpe?: number | null; // 0-10
  painDuringSession?: number | null; // 0-10
  painAfterSession?: number | null; // 0-10
  difficultyRating?: number | null; // 0-10, zu leicht..zu schwer
  satisfaction?: number | null; // 0-10
  wouldRepeat?: boolean | null;
  notes?: string | null;
}

export interface SessionExerciseLog {
  exerciseId: string;
  exerciseName: string;
  phase: Phase;
  order: number;
  side: Side;
  completed: boolean;
  setsCompleted: number[];
  painDuringExercise?: number | null; // 0-10
  notes?: string | null;
}

export interface TrainingSessionRecord {
  id: string;
  clientId: string;
  scheduledFor?: string | null;
  completedAt?: string | null;
  status: SessionStatus;
  pre?: PreQuestionnaire | null;
  post?: PostQuestionnaire | null;
  exercises: SessionExerciseLog[];
  notes?: string | null;
  createdAt: string; // ISO
}

function sessionsKey(clientId: string) {
  return `movura.sessions.${clientId}`;
}

export function listSessions(clientId: string): TrainingSessionRecord[] {
  const sessions = read<TrainingSessionRecord[]>(sessionsKey(clientId), []);
  return [...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSession(clientId: string, sessionId: string): TrainingSessionRecord | null {
  return listSessions(clientId).find((s) => s.id === sessionId) ?? null;
}

/** Upsert by id — used both to create a session and to save incremental
 * progress (pre-questionnaire now, exercise checkoffs later, post-
 * questionnaire at the end) without losing earlier parts. */
export function saveSession(session: TrainingSessionRecord): void {
  const existing = read<TrainingSessionRecord[]>(sessionsKey(session.clientId), []);
  const idx = existing.findIndex((s) => s.id === session.id);
  if (idx >= 0) existing[idx] = session;
  else existing.push(session);
  write(sessionsKey(session.clientId), existing);
}

export function createSessionFromPlan(clientId: string, plan: LatestPlanRecord): TrainingSessionRecord {
  const session: TrainingSessionRecord = {
    id: newId(),
    clientId,
    status: "PLANNED",
    exercises: plan.items.map((item) => ({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      phase: item.phase,
      order: item.order,
      side: item.side,
      completed: false,
      setsCompleted: [],
    })),
    createdAt: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}
