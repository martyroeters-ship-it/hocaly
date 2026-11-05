import { foldDiacritics, normalizeTurkish } from "@/lib/turkish"
import type { LearningStatus } from "@/lib/types"

export type VocabIndexItem = {
  id: string
  turkish: string
  english: string
  status: LearningStatus | string
}

const SPACE_TOKEN = /^\s+$/u
const WORD_TOKEN = /[\p{L}]/u
const SPACE_BEFORE_WORD = /[\p{L}.,!?;:…]/u

export function tokenize(text: string): string[] {
  return text.split(/(\s+|[.,!?;:"«»()[\]…]+)/).filter((token) => token.length > 0)
}

/** Keep tokenizer spaces, and insert a real space if two words were packed together. */
export function tokensWithSpacing(tokens: string[]): string[] {
  const out: string[] = []
  for (const token of tokens) {
    const prev = out[out.length - 1]
    if (prev && needsSpaceBetween(prev, token)) out.push(" ")
    out.push(token)
  }
  return out
}

function needsSpaceBetween(prev: string, next: string) {
  if (SPACE_TOKEN.test(prev) || SPACE_TOKEN.test(next)) return false
  if (!WORD_TOKEN.test(next)) return false
  return SPACE_BEFORE_WORD.test(prev)
}

export function lookupToken(token: string, vocab: VocabIndexItem[]): VocabIndexItem | undefined {
  const folded = foldDiacritics(token)
  if (!folded || !/[a-zçğıöşü]/i.test(token)) return undefined
  return vocab.find((item) => {
    const word = foldDiacritics(item.turkish)
    if (folded === word) return true
    if (word.length >= 4 && folded.startsWith(word.slice(0, Math.max(4, word.length - 3)))) return true
    const stem = normalizeTurkish(item.turkish).replace(/m[ae]k$/, "")
    return stem.length >= 3 && folded.startsWith(foldDiacritics(stem))
  })
}
