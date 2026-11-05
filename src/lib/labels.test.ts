import { describe, expect, it } from "vitest"
import { mergeLabels, parseLabels, visibleLabels } from "@/lib/labels"

describe("parseLabels", () => {
  it("splits comma lists and drops duplicates", () => {
    expect(parseLabels("Chapter 1, chapter 1; Unit 3")).toEqual(["Chapter 1", "Unit 3"])
  })

  it("trims and caps length", () => {
    expect(parseLabels("  Chapter  2  ")).toEqual(["Chapter 2"])
    expect(parseLabels("x".repeat(50))[0]?.length).toBe(40)
  })
})

describe("mergeLabels", () => {
  it("keeps photo tags and adds a chapter label", () => {
    expect(mergeLabels(["photo", "want-to-learn"], ["Chapter 1"])).toEqual(["photo", "want-to-learn", "Chapter 1"])
  })
})

describe("visibleLabels", () => {
  it("hides internal want-to-learn tags", () => {
    expect(visibleLabels(["photo", "want-to-learn", "Chapter 1"])).toEqual(["photo", "Chapter 1"])
  })
})
