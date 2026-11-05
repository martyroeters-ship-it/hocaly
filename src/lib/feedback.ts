import { RequestError } from "@/lib/api"

export const FEEDBACK_TYPES = ["question", "complaint", "suggestion"] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  question: "Question",
  complaint: "Complaint",
  suggestion: "Suggestion",
}

export const FEEDBACK_MAX_LENGTH = 4000
export const FEEDBACK_TO = "martyroeters@gmail.com"

export function isFeedbackType(value: string): value is FeedbackType {
  return FEEDBACK_TYPES.includes(value as FeedbackType)
}

export function parseFeedback(input: { type?: unknown; message?: unknown }) {
  const type = typeof input.type === "string" ? input.type.trim().toLowerCase() : ""
  if (!isFeedbackType(type)) {
    throw new RequestError("Choose Question, Complaint, or Suggestion.")
  }
  const message = typeof input.message === "string" ? input.message.trim() : ""
  if (!message) {
    throw new RequestError("Write a message before sending.")
  }
  if (message.length > FEEDBACK_MAX_LENGTH) {
    throw new RequestError(`Keep the message under ${FEEDBACK_MAX_LENGTH} characters.`)
  }
  return { type, message }
}
