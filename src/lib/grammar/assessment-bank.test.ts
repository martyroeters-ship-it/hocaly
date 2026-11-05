import { describe, expect, it } from "vitest"
import {
  ASSESSMENT_TEMPLATES,
  assessmentBankCoverage,
  buildAssessmentBankItems,
  templatesForStructure,
  validateQuestion,
} from "@/lib/grammar/assessment-bank"

describe("assessment bank validation", () => {
  it("every curated template passes validateQuestion", () => {
    const failures: string[] = []
    for (const template of ASSESSMENT_TEMPLATES) {
      const result = validateQuestion(template)
      if (!result.ok) {
        failures.push(`${template.structureId}: ${result.reason} ← ${template.blank}`)
      }
    }
    expect(failures).toEqual([])
  })

  it("covers high-frequency structures with at least 3 templates", () => {
    const required = [
      "present-continuous",
      "simple-past",
      "future",
      "future-negation",
      "aorist",
      "necessity",
      "ability",
      "purpose-mak-icin",
      "before-doing",
      "after-doing",
      "locative",
      "possessive-suffixes",
      "basic-passive",
      "basic-causative",
    ]
    for (const id of required) {
      expect(templatesForStructure(id).length, id).toBeGreaterThanOrEqual(3)
    }
  })

  it("spot-check: expected completes turkishFull and is not bare infinitive for tenses", () => {
    const future = templatesForStructure("future").find((row) => row.blank === "geleceğim")
    expect(future?.turkishFull).toContain("geleceğim")
    expect(future?.english.toLowerCase()).toContain("will come")

    const causative = templatesForStructure("basic-causative").find((row) => row.blank === "okuttun")
    expect(causative?.english).toMatch(/made someone read/i)
    expect(causative?.turkishFull).toContain("okuttun")

    const purpose = templatesForStructure("purpose-mak-icin").find((row) =>
      row.blank.includes("öğrenmek için"),
    )
    expect(purpose?.blank).toBe("öğrenmek için")
    expect(purpose?.turkishFull).toContain("öğrenmek için")

    for (const template of templatesForStructure("present-continuous")) {
      expect(template.blank.toLocaleLowerCase("tr-TR").endsWith("mak")).toBe(false)
      expect(template.blank.toLocaleLowerCase("tr-TR").endsWith("mek")).toBe(false)
    }
  })

  it("buildAssessmentBankItems only emits validated blanks with english + turkish cues", () => {
    const items = buildAssessmentBankItems(["present-continuous", "basic-causative", "purpose-mak-icin"], 3)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.englishPrompt?.trim().length).toBeGreaterThan(0)
      expect(item.turkishPrompt).toContain("______")
      expect(item.expected.trim().length).toBeGreaterThan(0)
      expect(item.uncertainKey).toBeFalsy()
      if (item.structureId !== "purpose-mak-icin" && item.structureId !== "infinitives") {
        const n = item.expected.trim().toLocaleLowerCase("tr-TR")
        expect(n.endsWith("mak") || n.endsWith("mek")).toBe(false)
      }
    }
  })

  it("reports coverage summary", () => {
    const coverage = assessmentBankCoverage()
    expect(coverage.length).toBeGreaterThanOrEqual(30)
    expect(coverage.every((row) => row.count >= 1)).toBe(true)
  })
})
