import { describe, expect, it } from "vitest"
import {
  dailyStudyHref,
  dailyStudySearchParams,
  filterWordsByPrefs,
  hasDailyStudyQuery,
  libraryLabels,
  parseDailyStudyQuery,
  parseDailyStudyPrefs,
  parseMinutes,
  toggleDailyStudySkill,
  wordCountForMinutes,
} from "@/lib/daily-study"

describe("parseMinutes", () => {
  it("defaults and snaps to the nearest chip", () => {
    expect(parseMinutes(undefined)).toBe(20)
    expect(parseMinutes(10)).toBe(10)
    expect(parseMinutes("25")).toBe(20)
    expect(parseMinutes(40)).toBe(45)
  })
})

describe("wordCountForMinutes", () => {
  it("scales about 8 words per 10 minutes", () => {
    expect(wordCountForMinutes(10)).toBe(8)
    expect(wordCountForMinutes(20)).toBe(16)
    expect(wordCountForMinutes(30)).toBe(24)
    expect(wordCountForMinutes(45)).toBe(36)
  })
})

describe("toggleDailyStudySkill", () => {
  it("keeps at least one skill", () => {
    expect(toggleDailyStudySkill(["words"], "words")).toEqual(["words"])
  })

  it("adds in canonical order", () => {
    expect(toggleDailyStudySkill(["listening"], "words")).toEqual(["words", "listening"])
  })
})

describe("parseDailyStudyPrefs", () => {
  it("fills defaults and drops unknown skills", () => {
    expect(parseDailyStudyPrefs({ minutes: 20, skills: ["words", "dance"], focus: "mixed", cefr: "A2" })).toEqual({
      minutes: 20,
      skills: ["words"],
      focus: "mixed",
      cefr: "A2",
      label: "",
    })
  })
})

describe("dailyStudyHref", () => {
  it("routes a single skill to its practice page", () => {
    expect(dailyStudyHref({ minutes: 10, skills: ["words"], focus: "to-learn", cefr: "any", label: "" })).toContain(
      "/tests/study?",
    )
    expect(dailyStudyHref({ minutes: 20, skills: ["listening"], focus: "to-learn", cefr: "A2", label: "" })).toContain(
      "/listen?",
    )
    expect(dailyStudyHref({ minutes: 20, skills: ["speaking"], focus: "mixed", cefr: "any", label: "" })).toContain(
      "/speak?",
    )
    expect(dailyStudyHref({ minutes: 30, skills: ["reading"], focus: "known", cefr: "B1", label: "" })).toContain(
      "/stories?",
    )
  })

  it("routes a mix to /study with the criteria query", () => {
    const href = dailyStudyHref({
      minutes: 20,
      skills: ["words", "listening"],
      focus: "to-learn",
      cefr: "A2",
      label: "",
    })
    expect(href.startsWith("/study?")).toBe(true)
    expect(href).toContain("minutes=20")
    expect(href).toContain("skills=words%2Clistening")
    expect(href).toContain("focus=to-learn")
    expect(href).toContain("cefr=A2")
  })
})

describe("parseDailyStudyQuery", () => {
  it("reads comma-separated skills from a query object", () => {
    const prefs = parseDailyStudyQuery({
      minutes: "10",
      skills: "words,listening",
      focus: "to-learn",
      cefr: "A2",
    })
    expect(prefs).toMatchObject({
      minutes: 10,
      skills: ["words", "listening"],
      focus: "to-learn",
      cefr: "A2",
    })
    expect(hasDailyStudyQuery({ q: "hello" })).toBe(false)
    expect(hasDailyStudyQuery({ minutes: "20" })).toBe(true)
  })

  it("round-trips search params", () => {
    const query = dailyStudySearchParams({
      minutes: 30,
      skills: ["reading", "speaking"],
      focus: "known",
      cefr: "B1",
      label: "Chapter 1",
    })
    expect(parseDailyStudyQuery(new URLSearchParams(query))).toEqual({
      minutes: 30,
      skills: ["speaking", "reading"],
      focus: "known",
      cefr: "B1",
      label: "Chapter 1",
    })
  })
})

describe("filterWordsByPrefs", () => {
  const words = [
    { id: "1", correctCount: 0, cefrLevel: "A1", tags: ["Chapter 1"] },
    { id: "2", correctCount: 3, cefrLevel: "A2", tags: ["Chapter 1"] },
    { id: "3", correctCount: 0, cefrLevel: "A2", tags: ["food"] },
  ]

  it("filters still-to-learn and CEFR when possible", () => {
    expect(
      filterWordsByPrefs(words, { focus: "to-learn", cefr: "A2", label: "" }).map((word) => word.id),
    ).toEqual(["3"])
  })

  it("filters by label", () => {
    expect(filterWordsByPrefs(words, { focus: "mixed", cefr: "any", label: "Chapter 1" }).map((word) => word.id)).toEqual(
      ["1", "2"],
    )
  })
})

describe("libraryLabels", () => {
  it("returns unique visible labels with display names", () => {
    expect(
      libraryLabels([
        { tags: ["photo", "want-to-learn", "Chapter 1"] },
        { tags: ["photo", "Chapter 1"] },
      ]),
    ).toEqual([
      { value: "Chapter 1", label: "Chapter 1" },
      { value: "photo", label: "From photos" },
    ])
  })
})
