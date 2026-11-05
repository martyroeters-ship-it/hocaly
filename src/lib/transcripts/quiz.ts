import { normalizeTurkish } from "@/lib/turkish"
import { shufflePick } from "@/lib/vocab/groups"
import { contentWordScore, looksLikeVerbForm } from "@/lib/transcripts/parse"

export type TranscriptQuizable = {
  turkish: string
  english?: string
  targetId?: string
}

/** One quiz card per normalized Turkish form (first glossed occurrence wins). */
export function dedupeTranscriptQuizItems<T extends TranscriptQuizable>(items: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const item of items) {
    const key = normalizeTurkish(item.turkish)
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, item)
      continue
    }
    const prevEn = (prev.english ?? "").trim()
    const nextEn = (item.english ?? "").trim()
    if (!prevEn && nextEn) byKey.set(key, item)
  }
  return [...byKey.values()]
}

/**
 * Deduplicate by normalized Turkish, then sample a mixed quiz: verbs + content
 * vocab, preferring harder words and avoiding a previous session's targets when
 * enough alternatives exist.
 */
export function selectTranscriptQuizItems<T extends TranscriptQuizable>(
  items: T[],
  count: number,
  options?: { avoidKeys?: Iterable<string> },
): T[] {
  const deduped = dedupeTranscriptQuizItems(items)
  const limit = Math.max(0, Math.min(count, deduped.length))
  if (!limit) return []

  const unique = deduped.map((item) => {
    const key = normalizeTurkish(item.turkish)
    return {
      key,
      item,
      verb: looksLikeVerbForm(item.turkish),
      score: contentWordScore(item.turkish),
    }
  })

  const avoid = new Set(
    [...(options?.avoidKeys ?? [])].map((key) => normalizeTurkish(key)).filter(Boolean),
  )
  const fresh = unique.filter((row) => !avoid.has(row.key))
  const pool = fresh.length >= Math.min(limit, unique.length) ? fresh : unique

  // Prefer the stronger half of each bucket so we don't always take the shortest/easiest.
  const rank = (rows: typeof pool) => {
    const sorted = [...rows].sort((a, b) => b.score - a.score)
    if (sorted.length <= 2) return sorted
    const keep = Math.max(2, Math.ceil(sorted.length * 0.7))
    return sorted.slice(0, keep)
  }

  const verbs = rank(pool.filter((row) => row.verb))
  const others = rank(pool.filter((row) => !row.verb))

  const verbSlots = Math.min(verbs.length, Math.max(1, Math.round(limit * 0.4)))
  const otherSlots = Math.min(others.length, Math.max(0, limit - verbSlots))

  const pickedKeys = new Set<string>()
  const picked: T[] = []

  const takeFrom = (rows: typeof pool, n: number) => {
    for (const row of shufflePick(rows, Math.min(n, rows.length))) {
      if (pickedKeys.has(row.key)) continue
      pickedKeys.add(row.key)
      picked.push(row.item)
    }
  }

  takeFrom(verbs, verbSlots)
  takeFrom(others, Math.max(otherSlots, limit - picked.length))

  if (picked.length < limit) {
    const leftover = shufflePick(
      pool.filter((row) => !pickedKeys.has(row.key)).sort((a, b) => b.score - a.score),
      limit - picked.length,
    )
    for (const row of leftover) {
      pickedKeys.add(row.key)
      picked.push(row.item)
    }
  }

  // If still short (tiny transcript), fill from full unique set
  if (picked.length < limit) {
    for (const row of shufflePick(
      unique.filter((row) => !pickedKeys.has(row.key)),
      limit - picked.length,
    )) {
      picked.push(row.item)
    }
  }

  return shufflePick(picked, picked.length)
}

/** Rank unique surface forms so gloss lookup prioritizes contentful words. */
export function prioritizeWordsForGloss(words: string[]) {
  const unique = [...new Map(words.map((word) => [normalizeTurkish(word), word] as const)).values()]
  return unique.sort((a, b) => contentWordScore(b) - contentWordScore(a) || b.length - a.length)
}
