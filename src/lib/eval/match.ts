import { foldDiacritics, levenshtein, normalizeTurkish, stripPunctuation } from "@/lib/turkish"
import type { EvalResult } from "@/lib/types"

function splitMeanings(value: string, lang: "tr" | "en"): string[] {
  const splitter = lang === "en" ? /\s*(?:;|\/|\||,|\bor\b)\s*/i : /\s*(?:;|\/|\||\bor\b)\s*/i
  return value
    .split(splitter)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function normalizeEnglish(input: string): string {
  return stripPunctuation(input)
    .toLocaleLowerCase("en-US")
    .replace(/^(to|the|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeAnswer(input: string, lang: "tr" | "en"): string {
  return lang === "tr" ? normalizeTurkish(stripPunctuation(input)) : normalizeEnglish(input)
}

function spellingThreshold(length: number): number {
  if (length <= 4) return 1
  if (length <= 8) return 2
  return 3
}

function tokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean)
}

function overlapScore(a: string, b: string): number {
  const aTokens = new Set(tokens(a))
  const bTokens = new Set(tokens(b))
  if (!aTokens.size || !bTokens.size) return 0
  let hit = 0
  for (const token of aTokens) if (bTokens.has(token)) hit += 1
  return hit / Math.max(aTokens.size, bTokens.size)
}

/**
 * Soft-g (k→ğ) is a real orthography rule, not a diacritic typo.
 * - ğ written as k always fails (gelecekiz for geleceğiz)
 * - ğ written as g is allowed as a spelling/diacritic miss (gelecegim ≈ geleceğim)
 */
export function isSoftGCollapse(givenNorm: string, answerNorm: string): boolean {
  if (!answerNorm.includes("ğ")) return false
  if (givenNorm === answerNorm.replaceAll("ğ", "k")) return true
  return false
}

export function evaluateAgainst(given: string, accepted: string[], lang: "tr" | "en"): {
  result: EvalResult
  matched?: string
} {
  const answers = accepted.flatMap((item) => splitMeanings(item, lang)).map((item) => item.trim()).filter(Boolean)
  if (!given.trim() || answers.length === 0) return { result: "incorrect" }

  const givenNorm = normalizeAnswer(given, lang)
  const givenFolded = foldDiacritics(givenNorm)

  for (const answer of answers) {
    const answerNorm = normalizeAnswer(answer, lang)
    if (givenNorm === answerNorm) return { result: "correct", matched: answer }
  }

  // Soft-g mistakes (gelecekiz for geleceğiz) must fail — not fuzzy-pass via fold/levenshtein.
  if (lang === "tr") {
    for (const answer of answers) {
      const answerNorm = normalizeAnswer(answer, lang)
      if (isSoftGCollapse(givenNorm, answerNorm)) return { result: "incorrect" }
    }
  }

  for (const answer of answers) {
    const answerNorm = normalizeAnswer(answer, lang)
    if (lang === "tr" && isSoftGCollapse(givenNorm, answerNorm)) continue
    const answerFolded = foldDiacritics(answerNorm)
    // Diacritic-only mismatches (ğ→g, ş→s) count as spelling — not structural typos.
    if (givenFolded === answerFolded && givenNorm !== answerNorm) {
      return { result: "spelling", matched: answer }
    }
    // Levenshtein fuzzy pass is English-only. For Turkish, missing buffer y
    // (yazmacaklar vs yazmayacaklar) or person/tense errors must stay incorrect.
    if (lang === "en") {
      const distance = levenshtein(givenFolded, answerFolded)
      if (distance > 0 && distance <= spellingThreshold(answerFolded.length)) {
        return { result: "spelling", matched: answer }
      }
    }
  }

  for (const answer of answers) {
    const answerNorm = normalizeAnswer(answer, lang)
    if (lang === "tr" && isSoftGCollapse(givenNorm, answerNorm)) continue
    if (
      givenNorm.includes(answerNorm) ||
      answerNorm.includes(givenNorm) ||
      overlapScore(givenNorm, answerNorm) >= 0.5
    ) {
      return { result: "partial", matched: answer }
    }
  }

  return { result: "incorrect" }
}

export function isPassing(result: EvalResult): boolean {
  return result === "correct" || result === "spelling"
}

/**
 * Translation grading: accept listed variants, then accept any sentence that
 * correctly uses the required grammar form (vocabulary can vary).
 */
export function evaluateTurkishTranslation(
  given: string,
  accepted: string[],
  requiredForm?: string,
): { result: EvalResult; matched?: string } {
  const direct = evaluateAgainst(given, accepted, "tr")
  if (isPassing(direct.result)) return direct

  const form = requiredForm?.trim()
  if (!form) return direct

  const givenNorm = normalizeAnswer(given, "tr")
  const formNorm = normalizeAnswer(form, "tr")
  if (!givenNorm || !formNorm) return direct

  const givenTokens = tokens(givenNorm)
  if (givenTokens.length < 2) return direct

  if (givenNorm.includes(formNorm)) {
    return { result: "correct", matched: form }
  }

  const givenFolded = foldDiacritics(givenNorm)
  const formFolded = foldDiacritics(formNorm)
  if (formFolded && givenFolded.includes(formFolded)) {
    return { result: "spelling", matched: form }
  }

  // With a required form, fuzzy/partial overlap on the full sentence is not enough.
  return { result: "incorrect" }
}
