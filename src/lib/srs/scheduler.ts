import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs"
import type { SrsCard } from "@prisma/client"
import type { SrsRating } from "@/lib/types"

/** Default FSRS target retention (~90%). Override via Settings.desiredRetention when wiring a live scheduler. */
export const DEFAULT_DESIRED_RETENTION = 0.9

/** Review interval (days) at or above which a card is treated as mature. */
export const MATURE_INTERVAL_DAYS = 21

/** Lapse count at which a word is treated as a leech / difficult item. */
export const LEECH_LAPSES = 8

const scheduler = fsrs({
  request_retention: DEFAULT_DESIRED_RETENTION,
  enable_fuzz: true,
  enable_short_term: true,
})

const RATING_MAP: Record<SrsRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

const STATE_NAME: Record<State, SrsCard["state"]> = {
  [State.New]: "New",
  [State.Learning]: "Learning",
  [State.Review]: "Review",
  [State.Relearning]: "Relearning",
}

export function emptySrsCard(now = new Date()): Card {
  return createEmptyCard(now)
}

export function toFsrsCard(row: SrsCard): Card {
  const state = State[row.state as keyof typeof State] ?? State.New
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state,
    last_review: row.lastReview ?? undefined,
  }
}

export function fromFsrsCard(wordId: string, card: Card): Omit<SrsCard, "word"> {
  return {
    wordId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_NAME[card.state] ?? "New",
    lastReview: card.last_review ?? null,
  }
}

export function schedule(card: Card, rating: SrsRating, now = new Date()) {
  return scheduler.next(card, now, RATING_MAP[rating])
}

export function preview(card: Card, now = new Date()) {
  const result = scheduler.repeat(card, now)
  return {
    again: result[Rating.Again].card.due,
    hard: result[Rating.Hard].card.due,
    good: result[Rating.Good].card.due,
    easy: result[Rating.Easy].card.due,
  }
}

/** Predicted probability of successful recall at `now` (0–1). */
export function retrievability(card: Card | null | undefined, now = new Date()): number | null {
  if (!card || card.state === State.New || card.stability <= 0) return null
  const value = scheduler.get_retrievability(card, now, false)
  if (typeof value !== "number" || Number.isNaN(value)) return null
  return Math.min(1, Math.max(0, value))
}

export function isMature(card: Card | null | undefined): boolean {
  if (!card) return false
  return card.state === State.Review && card.scheduled_days >= MATURE_INTERVAL_DAYS && card.reps >= 5
}

export function isLeech(card: Card | null | undefined, threshold = LEECH_LAPSES): boolean {
  if (!card) return false
  return card.lapses >= threshold
}

/**
 * Learning bucket for progress UI.
 * "mastered" is kept as a legacy alias of mature for existing statuses.
 */
export function derivedStatus(card: Card | null, reviewCount: number): "new" | "learning" | "reviewing" | "mastered" {
  if (!card || card.state === State.New || reviewCount === 0) return "new"
  if (card.state === State.Learning || card.state === State.Relearning) return "learning"
  if (isMature(card)) return "mastered"
  return "reviewing"
}

export function ratingFromEval(correct: boolean, confidence: SrsRating | null): SrsRating {
  if (!correct) return "again"
  return confidence ?? "good"
}
