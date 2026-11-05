import { describe, expect, it } from "vitest"
import { cefrFromSessionOrProfile, DEFAULT_CEFR, isCefrLevel, parseCefrLevel } from "@/lib/cefr"

describe("parseCefrLevel", () => {
  it("keeps valid levels and falls back to A2", () => {
    expect(parseCefrLevel("B1")).toBe("B1")
    expect(parseCefrLevel("A1")).toBe("A1")
    expect(parseCefrLevel("any")).toBe(DEFAULT_CEFR)
    expect(parseCefrLevel(undefined)).toBe("A2")
    expect(isCefrLevel("C2")).toBe(true)
    expect(isCefrLevel("any")).toBe(false)
  })
})

describe("cefrFromSessionOrProfile", () => {
  it("uses a session override and otherwise the profile default", () => {
    expect(cefrFromSessionOrProfile("B1", "A1")).toBe("B1")
    expect(cefrFromSessionOrProfile("any", "A1")).toBe("A1")
    expect(cefrFromSessionOrProfile(undefined, "C1")).toBe("C1")
    expect(cefrFromSessionOrProfile(null, undefined)).toBe("A2")
  })
})
