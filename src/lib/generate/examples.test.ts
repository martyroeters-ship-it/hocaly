import { describe, expect, it } from "vitest"
import {
  EXAMPLE_SOURCE,
  looksLikeBrokenExample,
  shouldGenerateWordExample,
  storedExample,
} from "@/lib/generate/examples"

const saved = {
  examples: [
    {
      id: "ex1",
      turkish: "Bugün evdeyim.",
      english: "I am at home today.",
      source: EXAMPLE_SOURCE,
    },
  ],
}

describe("word example reuse", () => {
  it("reuses a stored sentence instead of generating", () => {
    expect(storedExample(saved)).toEqual({
      id: "ex1",
      turkish: "Bugün evdeyim.",
      english: "I am at home today.",
      highlight: null,
      reused: true,
    })
    expect(shouldGenerateWordExample(saved)).toBe(false)
  })

  it("generates when nothing is stored yet", () => {
    expect(storedExample({ examples: [] })).toBeNull()
    expect(storedExample({ examples: [{ turkish: "  ", english: "x" }] })).toBeNull()
    expect(shouldGenerateWordExample({ examples: [] })).toBe(true)
  })

  it("generates again when refresh is requested", () => {
    expect(shouldGenerateWordExample(saved, true)).toBe(true)
  })

  it("does not reuse old unversioned sentences", () => {
    expect(
      storedExample({
        examples: [{ id: "old", turkish: "Bugün evdeyim.", english: "I am at home today.", source: "ai" }],
      }),
    ).toBeNull()
  })

  it("still reuses a favorite even if the source is older", () => {
    expect(
      storedExample({
        examples: [
          {
            id: "fav",
            turkish: "Bugün evdeyim.",
            english: "I am at home today.",
            source: "ai",
            favorite: true,
          },
        ],
      })?.id,
    ).toBe("fav")
  })
})

describe("broken example detection", () => {
  it("rejects the addiction-to-health mash-up", () => {
    expect(
      looksLikeBrokenExample(
        {
          turkish: "Sigara sağlığa büyük bir bağımlılık yapar.",
          english: "Smoking creates a major addiction to health.",
        },
        { turkish: "bağımlılık", english: "addiction" },
      ),
    ).toBe(true)
    expect(
      storedExample({
        id: "w1",
        turkish: "bağımlılık",
        partOfSpeech: "noun",
        meanings: [{ english: "addiction", isPrimary: true }],
        examples: [
          {
            turkish: "Sigara sağlığa büyük bir bağımlılık yapar.",
            english: "Smoking creates a major addiction to health.",
            source: EXAMPLE_SOURCE,
            favorite: true,
          },
        ],
      }),
    ).toBeNull()
  })

  it("keeps a natural addiction sentence", () => {
    expect(
      looksLikeBrokenExample(
        {
          turkish: "Sigara ciddi bir bağımlılık yapar.",
          english: "Smoking causes a serious addiction.",
        },
        { turkish: "bağımlılık", english: "addiction" },
      ),
    ).toBe(false)
  })
})
