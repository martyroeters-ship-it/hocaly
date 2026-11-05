import { describe, expect, it } from "vitest"
import { faceFromTestMode, suggestVocabFace } from "@/lib/srs/faces"

describe("suggestVocabFace", () => {
  it("starts with recognition for new words", () => {
    expect(suggestVocabFace([])).toBe("recognition")
  })

  it("introduces production after a few recognition reviews", () => {
    expect(
      suggestVocabFace([
        {
          skill: "recognition",
          nextReviewAt: new Date("2099-01-01"),
          reviewCount: 3,
          correctCount: 3,
          lapses: 0,
          stability: 2,
          state: "Review",
        },
      ]),
    ).toBe("production")
  })

  it("prefers the weaker production face", () => {
    expect(
      suggestVocabFace([
        {
          skill: "recognition",
          nextReviewAt: new Date("2099-01-01"),
          reviewCount: 10,
          correctCount: 9,
          lapses: 0,
          stability: 20,
          state: "Review",
        },
        {
          skill: "production",
          nextReviewAt: new Date("2099-01-01"),
          reviewCount: 10,
          correctCount: 4,
          lapses: 3,
          stability: 2,
          state: "Review",
        },
      ]),
    ).toBe("production")
  })
})

describe("faceFromTestMode", () => {
  it("maps modes to faces", () => {
    expect(faceFromTestMode("tr-en")).toBe("recognition")
    expect(faceFromTestMode("en-tr")).toBe("production")
    expect(faceFromTestMode("sentence")).toBe("production")
  })
})
