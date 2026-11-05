import { normalizeEnglish } from "@/lib/eval/match"
import { foldDiacritics, normalizeTurkish } from "@/lib/turkish"

export type SearchableWord = {
  turkish: string
  english: string
  dictionaryForm?: string | null
  meanings?: string[]
}

function fieldMatches(field: string, qNorm: string, qFold: string, qEn: string) {
  if (!field) return false
  const tr = normalizeTurkish(field)
  const fold = foldDiacritics(field)
  const en = normalizeEnglish(field)
  return (
    (qNorm.length > 0 && tr.includes(qNorm)) ||
    (qFold.length > 0 && fold.includes(qFold)) ||
    (qEn.length > 0 && en.includes(qEn))
  )
}

export function wordMatchesQuery(word: SearchableWord, query: string) {
  const raw = query.trim()
  if (!raw) return true

  const qNorm = normalizeTurkish(raw)
  const qFold = foldDiacritics(raw)
  const qEn = normalizeEnglish(raw)
  const fields = [word.turkish, word.dictionaryForm ?? "", word.english, ...(word.meanings ?? [])]

  return fields.some((field) => fieldMatches(field, qNorm, qFold, qEn))
}

export function filterWords<T extends SearchableWord>(words: T[], query: string, unfilteredLimit = 80) {
  const raw = query.trim()
  if (!raw) return words.slice(0, unfilteredLimit)
  return words.filter((word) => wordMatchesQuery(word, raw))
}
