import type { VocabFace } from "@/lib/types"

export type FaceSkillSnapshot = {
  skill: VocabFace
  nextReviewAt: Date | null
  reviewCount: number
  correctCount: number
  lapses: number
  stability: number
  state: string
}

/**
 * Pick recognition vs production for this review without creating a second due card.
 * Prefers the weaker / less-practised face; new words start with recognition.
 */
export function suggestVocabFace(
  skills: FaceSkillSnapshot[],
  options?: { preferProductionAfter?: number },
): VocabFace {
  const preferAfter = options?.preferProductionAfter ?? 2
  const recognition = skills.find((item) => item.skill === "recognition")
  const production = skills.find((item) => item.skill === "production")

  if (!recognition || recognition.reviewCount === 0) return "recognition"
  if (!production || production.reviewCount === 0) {
    return recognition.reviewCount >= preferAfter ? "production" : "recognition"
  }

  const now = Date.now()
  const recognitionDue = !recognition.nextReviewAt || recognition.nextReviewAt.getTime() <= now
  const productionDue = !production.nextReviewAt || production.nextReviewAt.getTime() <= now
  if (productionDue && !recognitionDue) return "production"
  if (recognitionDue && !productionDue) return "recognition"

  const recognitionAcc = recognition.reviewCount
    ? recognition.correctCount / recognition.reviewCount
    : 1
  const productionAcc = production.reviewCount
    ? production.correctCount / production.reviewCount
    : 1
  if (production.lapses > recognition.lapses) return "production"
  if (productionAcc + 0.05 < recognitionAcc) return "production"
  if (recognitionAcc + 0.05 < productionAcc) return "recognition"

  // Alternate by total practice count for balance.
  return recognition.reviewCount <= production.reviewCount ? "recognition" : "production"
}

export function faceFromTestMode(mode: string): VocabFace | null {
  if (mode === "tr-en" || mode === "multiple-choice" || mode === "listening") return "recognition"
  if (mode === "en-tr" || mode === "cloze" || mode === "sentence") return "production"
  return null
}
