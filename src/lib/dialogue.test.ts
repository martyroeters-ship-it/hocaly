import { describe, expect, it } from "vitest"
import {
  DIALOGUE_PRESETS,
  fallbackDialogueFollowUp,
  fallbackDialogueOpener,
  guessDialogueSpeaker,
  resolveDialogueScenario,
} from "@/lib/dialogue"

describe("dialogue scenarios", () => {
  it("has restaurant and bus presets with waiter and bus employee", () => {
    const restaurant = DIALOGUE_PRESETS.find((item) => item.id === "restaurant")
    const bus = DIALOGUE_PRESETS.find((item) => item.id === "bus")
    expect(restaurant?.speaker).toBe("Waiter")
    expect(bus?.speaker).toBe("Bus employee")
    expect(DIALOGUE_PRESETS.length).toBeGreaterThanOrEqual(6)
  })

  it("uses a waiter opener for restaurant when Gemini is unavailable", () => {
    const resolved = resolveDialogueScenario({ presetId: "restaurant" })
    const opener = fallbackDialogueOpener(resolved)
    expect(opener.speaker).toBe("Waiter")
    expect(opener.turkish.toLocaleLowerCase("tr-TR")).toContain("merhaba")
    expect(opener.english.toLowerCase()).toMatch(/welcome|hello/)
  })

  it("uses a bus-employee opener for the bus station", () => {
    const opener = fallbackDialogueOpener(resolveDialogueScenario({ presetId: "bus" }))
    expect(opener.speaker).toBe("Bus employee")
    expect(opener.turkish.toLocaleLowerCase("tr-TR")).toMatch(/nereye|bilet|otobüs/)
  })

  it("starts a bakery scene as a baker", () => {
    const resolved = resolveDialogueScenario({ topic: "bakery" })
    expect(resolved.id).toBe("custom")
    expect(resolved.speaker).toBe("Baker")
    expect(guessDialogueSpeaker("bakery")).toBe("Baker")
    const opener = fallbackDialogueOpener(resolved)
    expect(opener.speaker).toBe("Baker")
    expect(opener.turkish.length).toBeGreaterThan(0)
  })

  it("keeps a follow-up in character when Gemini fails mid-chat", () => {
    const follow = fallbackDialogueFollowUp("Waiter")
    expect(follow.speaker).toBe("Waiter")
    expect(follow.turkish.length).toBeGreaterThan(0)
  })
})
