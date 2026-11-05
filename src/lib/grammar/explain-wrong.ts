import { foldDiacritics, normalizeTurkish, stripPunctuation } from "@/lib/turkish"

function tokens(value: string) {
  return stripPunctuation(value)
    .split(/\s+/)
    .map((part) => normalizeTurkish(part))
    .filter(Boolean)
}

/**
 * Short learner-facing reason for a wrong Turkish answer in results review.
 */
export function explainWrongAnswer(given: string, expected: string, structureId?: string): string {
  const givenRaw = given.trim()
  const expectedRaw = expected.trim()
  if (!givenRaw) return "You left this blank — type the full Turkish answer."
  if (!expectedRaw) return "This doesn’t match the expected Turkish form."

  const givenNorm = normalizeTurkish(stripPunctuation(givenRaw))
  const expectedNorm = normalizeTurkish(stripPunctuation(expectedRaw))
  if (givenNorm === expectedNorm) {
    return "Almost — check punctuation or spacing against the right answer."
  }

  const givenFolded = foldDiacritics(givenNorm)
  const expectedFolded = foldDiacritics(expectedNorm)
  if (givenFolded === expectedFolded) {
    return "Spelling: add the missing Turkish letters (ç, ğ, ı, ö, ş, ü)."
  }

  // Soft-g collapse (gelecekiz for geleceğiz)
  if (expectedNorm.includes("ğ") && givenNorm === expectedNorm.replaceAll("ğ", "k")) {
    return "Soft g: before a vowel, k becomes ğ (for example geleceğim, not gelecekiz)."
  }

  const givenTokens = tokens(givenRaw)
  const expectedTokens = tokens(expectedRaw)

  const missing = expectedTokens.filter((token) => !givenTokens.some((g) => foldDiacritics(g) === foldDiacritics(token)))
  const extra = givenTokens.filter((token) => !expectedTokens.some((e) => foldDiacritics(e) === foldDiacritics(token)))

  const diacriticWord = expectedTokens.find((token, index) => {
    const g = givenTokens[index]
    if (!g) return false
    return foldDiacritics(g) === foldDiacritics(token) && g !== token
  })

  const reasons: string[] = []

  if (missing.length === 1) {
    reasons.push(`Missing word: “${missing[0]}”.`)
  } else if (missing.length > 1 && missing.length <= 3) {
    reasons.push(`Missing words: ${missing.map((w) => `“${w}”`).join(", ")}.`)
  } else if (missing.length > 3) {
    reasons.push("Several words are missing from the expected sentence.")
  }

  if (diacriticWord) {
    reasons.push(`Spelling on “${diacriticWord}”: keep Turkish special letters.`)
  } else {
    const foldedMissingLetter = expectedTokens.find((token) => {
      const hit = givenTokens.find((g) => foldDiacritics(g) === foldDiacritics(token) && g !== token)
      return Boolean(hit)
    })
    if (foldedMissingLetter) {
      reasons.push(`Spelling: “${foldedMissingLetter}” needs the correct Turkish letters.`)
    }
  }

  if (extra.length === 1 && missing.length === 0) {
    reasons.push(`Extra word: “${extra[0]}” isn’t needed here.`)
  }

  if (structureId?.includes("without") && /madan|meden/.test(expectedNorm) && !/madan|meden/.test(givenNorm)) {
    reasons.push("Use the -madan/-meden (“without doing”) form.")
  } else if (structureId?.includes("before") && !/madan önce|meden önce/.test(givenNorm) && /madan önce|meden önce/.test(expectedNorm)) {
    reasons.push("Use -madan/-meden önce (“before doing”).")
  } else if (structureId?.includes("after") && !/dikten|dıktan|duktan|dükten|tikten|tıktan/.test(givenNorm)) {
    if (/dikten|dıktan|duktan|dükten|tikten|tıktan/.test(expectedNorm)) {
      reasons.push("Use the -dıktan/-dikten sonra (“after doing”) form.")
    }
  }

  // Person / ending swap when stems match after fold
  if (givenTokens.length === 1 && expectedTokens.length === 1) {
    const g = givenFolded
    const e = expectedFolded
    if (g.length > 3 && e.length > 3 && (g.startsWith(e.slice(0, -2)) || e.startsWith(g.slice(0, -2)))) {
      reasons.push("The ending doesn’t match the expected person or tense.")
    }
  }

  if (reasons.length) return reasons.slice(0, 2).join(" ")

  if (givenTokens.length < expectedTokens.length) {
    return "Your answer is incomplete — compare it with the full right answer."
  }
  if (givenTokens.length > expectedTokens.length) {
    return "Your answer has extra words — compare it with the right answer."
  }

  return "This doesn’t match the expected Turkish. Check grammar and word choice against the right answer."
}
