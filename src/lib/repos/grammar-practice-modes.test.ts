import { describe, expect, it } from "vitest"
import { practiceModesPassedToday } from "@/lib/repos/grammar-practice"

describe("practiceModesPassedToday", () => {
  it("marks modes with ≥80% today (8/10+)", () => {
    const raw = JSON.stringify({
      conjugation: { day: "2026-11-05", score: 8, total: 10 },
      blank: { day: "2026-11-05", score: 7, total: 10 },
      translate: { day: "2026-11-05", score: 9, total: 10 },
      master: { day: "2026-11-04", score: 10, total: 10 },
    })
    expect(practiceModesPassedToday(raw, "2026-11-05").sort()).toEqual([
      "conjugation",
      "translate",
    ])
  })
})
