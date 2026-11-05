import { guessPartOfSpeech } from "@/lib/import/parse"
import { normalizeTurkish } from "@/lib/turkish"
import type { ParsedImportRow, PartOfSpeech } from "@/lib/types"

export type HighlightedWord = {
  turkish: string
  dictionaryForm?: string
  english?: string
  extraMeanings?: string[]
  partOfSpeech?: PartOfSpeech
  context?: string
  highlightColor?: string
}

const PHOTO_TAGS = ["photo", "want-to-learn"]

export function highlightsToParsedRows(words: HighlightedWord[]): ParsedImportRow[] {
  const rows: ParsedImportRow[] = []
  const seen = new Set<string>()

  words.forEach((word, index) => {
    const highlighted = word.turkish.trim()
    if (!highlighted) return
    const headword = (word.dictionaryForm ?? highlighted).trim()
    const normalized = normalizeTurkish(headword)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)

    const notes = [
      headword !== highlighted ? `Highlighted as “${highlighted}”` : null,
      word.highlightColor ? `Marker: ${word.highlightColor}` : null,
    ]
      .filter(Boolean)
      .join(". ")

    rows.push({
      turkish: headword,
      english: word.english?.trim() || undefined,
      extraMeanings: word.extraMeanings?.map((item) => item.trim()).filter(Boolean),
      tags: PHOTO_TAGS,
      partOfSpeech: word.partOfSpeech ?? guessPartOfSpeech(headword),
      notes: notes || undefined,
      context: word.context?.trim() || undefined,
      highlightedForm: highlighted !== headword ? highlighted : undefined,
      lineNumber: index + 1,
    })
  })

  return rows
}
