import { describe, expect, it } from "vitest"
import {
  derivedStatus,
  emptySrsCard,
  isLeech,
  isMature,
  retrievability,
  schedule,
} from "@/lib/srs/scheduler"

describe("FSRS scheduler", () => {
  it("does not mark a word mastered after one good answer", () => {
    const first = schedule(emptySrsCard(new Date("2026-01-01T10:00:00Z")), "good", new Date("2026-01-01T10:00:00Z"))
    expect(derivedStatus(first.card, 1)).not.toBe("mastered")
    expect(isMature(first.card)).toBe(false)
    expect(first.card.reps).toBeGreaterThanOrEqual(1)
  })

  it("schedules again sooner than easy", () => {
    const now = new Date("2026-01-01T10:00:00Z")
    let card = emptySrsCard(now)
    card = schedule(card, "good", now).card
    const later = new Date("2026-01-08T10:00:00Z")
    const again = schedule(card, "again", later).card
    const easy = schedule(card, "easy", later).card
    expect(again.due.getTime()).toBeLessThan(easy.due.getTime())
  })

  it("lengthens the interval after repeated successful recall", () => {
    let card = emptySrsCard(new Date("2026-01-01T10:00:00Z"))
    const intervals: number[] = []
    for (let i = 0; i < 6; i += 1) {
      card = schedule(card, "good", card.due).card
      intervals.push(card.scheduled_days)
    }
    expect(Math.max(...intervals)).toBeGreaterThan(intervals[0] ?? 0)
  })

  it("reports high retrievability right after a successful review", () => {
    const now = new Date("2026-01-01T10:00:00Z")
    const card = schedule(emptySrsCard(now), "good", now).card
    const R = retrievability(card, now)
    expect(R).not.toBeNull()
    expect(R!).toBeGreaterThan(0.85)
  })

  it("marks forgotten cards as leeches after enough lapses", () => {
    let card = emptySrsCard(new Date("2026-01-01T10:00:00Z"))
    for (let i = 0; i < 3; i += 1) card = schedule(card, "good", card.due).card
    card = schedule(card, "again", card.due).card
    expect(card.lapses).toBeGreaterThanOrEqual(1)
    expect(isLeech({ ...card, lapses: 8 })).toBe(true)
    expect(isLeech({ ...card, lapses: 2 })).toBe(false)
  })
})
