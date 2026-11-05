import { evaluateAgainst } from "@/lib/eval/match"
import { foldDiacritics, normalizeTurkish, stripPunctuation } from "@/lib/turkish"
import type { EvalResult, SpokenFeedback } from "@/lib/types"

export const SPOKEN_DISCLAIMER =
  "This compares recognized words with the prompt. It does not measure pronunciation quality."

const FUNCTION_WORDS = new Set([
  "ve",
  "ile",
  "de",
  "da",
  "mi",
  "mı",
  "mu",
  "mü",
  "bir",
  "bu",
  "şu",
  "o",
  "ne",
  "ya",
  "ama",
  "ki",
])

export function tokenizeTurkish(input: string): string[] {
  return stripPunctuation(normalizeTurkish(input))
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function foldedSet(tokens: string[]): Set<string> {
  return new Set(tokens.map((token) => foldDiacritics(token)))
}

export function compareSpoken(expected: string, transcript: string): SpokenFeedback {
  const expectedTokens = tokenizeTurkish(expected)
  const givenTokens = tokenizeTurkish(transcript)
  const givenFolded = foldedSet(givenTokens)
  const expectedFolded = foldedSet(expectedTokens)

  const matched: string[] = []
  const missing: string[] = []
  for (const token of expectedTokens) {
    if (givenFolded.has(foldDiacritics(token))) matched.push(token)
    else missing.push(token)
  }
  const extra = givenTokens.filter((token) => !expectedFolded.has(foldDiacritics(token)))

  const contentExpected = expectedTokens.filter((token) => !FUNCTION_WORDS.has(foldDiacritics(token)))
  const contentMissing = missing.filter((token) => !FUNCTION_WORDS.has(foldDiacritics(token)))
  const coverage = contentExpected.length
    ? (contentExpected.length - contentMissing.length) / contentExpected.length
    : expectedTokens.length
      ? matched.length / expectedTokens.length
      : 0

  let result: EvalResult = "incorrect"
  if (!givenTokens.length) result = "incorrect"
  else if (coverage >= 0.9 && extra.length <= 1) result = "correct"
  else if (coverage >= 0.75) result = "spelling"
  else if (coverage >= 0.45) result = "partial"
  else {
    const fallback = evaluateAgainst(transcript, [expected], "tr").result
    result = fallback === "correct" ? "correct" : fallback
  }

  return {
    result,
    missing: [...new Set(missing)],
    extra: [...new Set(extra)],
    matched: [...new Set(matched)],
    coverage,
    disclaimer: SPOKEN_DISCLAIMER,
  }
}

export function ratingFromSkillResult(result: EvalResult) {
  if (result === "correct") return "good" as const
  if (result === "spelling" || result === "partial") return "hard" as const
  return "again" as const
}
