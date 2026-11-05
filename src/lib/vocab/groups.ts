import { normalizeEnglish } from "@/lib/eval/match"
import { displayLabel, visibleLabels } from "@/lib/labels"
import { foldDiacritics, normalizeTurkish } from "@/lib/turkish"
import { LEXICON_GROUPS } from "@/lib/vocab/lexicon"

export type GroupableWord = {
  id: string
  turkish: string
  english: string
  meanings: string[]
  partOfSpeech?: string | null
  tags?: string[]
}

export type VocabGroup = {
  id: string
  name: string
  help: string
  wordIds: string[]
  source: "lexicon" | "label" | "pos" | "ai"
}

function haystack(word: GroupableWord) {
  return {
    tr: normalizeTurkish(word.turkish),
    trFold: foldDiacritics(word.turkish),
    en: normalizeEnglish([word.english, ...(word.meanings ?? [])].join(" ; ")),
  }
}

function phraseIn(text: string, phrase: string) {
  if (!phrase) return false
  if (text === phrase) return true
  return ` ${text} `.includes(` ${phrase} `)
}

export function wordMatchesLexicon(word: GroupableWord, turkish: string[], english: string[]) {
  const { tr, trFold, en } = haystack(word)
  for (const item of turkish) {
    const n = normalizeTurkish(item)
    if (phraseIn(tr, n) || phraseIn(trFold, foldDiacritics(item))) return true
  }
  for (const item of english) {
    const n = normalizeEnglish(item)
    if (n && phraseIn(en, n)) return true
  }
  return false
}

function posGroup(id: string, name: string, help: string, words: GroupableWord[], pos: string[]): VocabGroup | null {
  const wordIds = words.filter((word) => pos.includes(word.partOfSpeech ?? "")).map((word) => word.id)
  if (wordIds.length < 4) return null
  return { id, name, help, wordIds, source: "pos" }
}

export function localGroups(words: GroupableWord[]): VocabGroup[] {
  const groups: VocabGroup[] = []

  for (const lexicon of LEXICON_GROUPS) {
    const wordIds = words.filter((word) => wordMatchesLexicon(word, lexicon.turkish, lexicon.english)).map((word) => word.id)
    if (!wordIds.length) continue
    groups.push({
      id: lexicon.id,
      name: lexicon.name,
      help: lexicon.help,
      wordIds,
      source: "lexicon",
    })
  }

  const verbs = posGroup("verbs", "Verbs", "Actions in your list.", words, ["verb"])
  const adjectives = posGroup("adjectives", "Adjectives", "Descriptions in your list.", words, ["adjective"])
  const nouns = posGroup("nouns", "Nouns", "Things and people in your list.", words, ["noun"])
  for (const group of [verbs, adjectives, nouns]) if (group) groups.push(group)

  const labels = new Map<string, string[]>()
  for (const word of words) {
    for (const tag of visibleLabels(word.tags ?? [])) {
      const list = labels.get(tag) ?? []
      list.push(word.id)
      labels.set(tag, list)
    }
  }
  for (const [tag, wordIds] of labels) {
    groups.push({
      id: `label:${tag}`,
      name: displayLabel(tag),
      help: "A label you added.",
      wordIds,
      source: "label",
    })
  }

  return groups
}

const RESERVED_GROUP_NAMES = /sentence glue|connector|conjunction|discourse|bağlaç|time & sequence|time expressions|question words|greetings/

function overlapRatio(left: string[], right: string[]) {
  if (!right.length) return 0
  const set = new Set(left)
  return right.filter((id) => set.has(id)).length / right.length
}

export function mergeGroups(local: VocabGroup[], extra: VocabGroup[]) {
  const seen = new Set(local.map((group) => group.name.toLocaleLowerCase("en-US")))
  const merged = [...local]
  for (const group of extra) {
    const name = group.name.trim()
    const key = name.toLocaleLowerCase("en-US")
    if (!name || seen.has(key) || RESERVED_GROUP_NAMES.test(key)) continue
    const wordIds = [...new Set(group.wordIds)]
    if (wordIds.length < 2) continue
    if (local.some((item) => overlapRatio(item.wordIds, wordIds) >= 0.5)) continue
    seen.add(key)
    merged.push({ ...group, name, wordIds, source: "ai" })
  }
  return merged
}

export function shufflePick<T>(items: T[], count: number) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)))
}

export function toLearnIds(words: { id: string; correctCount?: number }[]) {
  const fresh = words.filter((word) => !word.correctCount).map((word) => word.id)
  return fresh.length ? fresh : words.map((word) => word.id)
}
