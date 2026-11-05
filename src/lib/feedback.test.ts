import { describe, expect, it } from "vitest"
import { RequestError } from "@/lib/api"
import { parseFeedback } from "@/lib/feedback"

describe("parseFeedback", () => {
  it("requires a known type", () => {
    expect(() => parseFeedback({ type: "other", message: "Hello" })).toThrow(RequestError)
  })

  it("requires a non-empty message", () => {
    expect(() => parseFeedback({ type: "suggestion", message: "   " })).toThrow(RequestError)
  })

  it("caps message length", () => {
    expect(() => parseFeedback({ type: "question", message: "x".repeat(4001) })).toThrow(RequestError)
  })

  it("normalizes a valid payload", () => {
    expect(parseFeedback({ type: " Suggestion ", message: "  Add dark mode  " })).toEqual({
      type: "suggestion",
      message: "Add dark mode",
    })
  })
})
