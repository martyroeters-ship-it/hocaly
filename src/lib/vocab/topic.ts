import { normalizeEnglish } from "@/lib/eval/match"
import { foldDiacritics, normalizeTurkish } from "@/lib/turkish"
import type { GroupableWord } from "@/lib/vocab/groups"

const HINTS: Record<string, string[]> = {
  holiday: ["holiday", "vacation", "travel", "beach", "sea", "sun", "summer", "hotel", "swim", "sky", "sand", "trip", "coast"],
  food: ["food", "eat", "cook", "meal", "fruit", "drink", "kitchen", "boil", "chop", "dessert", "nutrition", "restaurant"],
  home: ["home", "house", "room", "family", "kitchen", "door", "table"],
  people: ["friend", "family", "person", "people", "adult", "child", "teacher"],
  work: ["work", "job", "office", "study", "school", "progress"],
  body: ["body", "hand", "head", "health", "sick", "sneeze", "palm"],
  nature: ["sky", "sea", "sun", "tree", "animal", "ant", "water"],
  feelings: ["happy", "sad", "angry", "tired", "peace", "like", "love", "habit"],
}

function tokens(value: string) {
  return normalizeEnglish(value)
    .split(/\s+/)
    .filter((item) => item.length > 2)
}

function hasToken(text: string, token: string) {
  if (!token) return false
  return ` ${text} `.includes(` ${token} `)
}

export function topicScore(word: GroupableWord, topic: string) {
  const query = normalizeEnglish(topic)
  const foldedQuery = foldDiacritics(topic)
  const tr = normalizeTurkish(word.turkish)
  const trFold = foldDiacritics(word.turkish)
  const en = normalizeEnglish([word.english, ...(word.meanings ?? [])].join(" "))
  let score = 0
  if (hasToken(tr, normalizeTurkish(topic)) || hasToken(trFold, foldedQuery) || hasToken(en, query)) score += 5
  const queryTokens = tokens(topic)
  const extra = Object.entries(HINTS)
    .filter(([key, words]) => hasToken(query, key) || words.some((item) => hasToken(query, item)))
    .flatMap(([, words]) => words)
  for (const token of [...queryTokens, ...extra]) {
    const folded = foldDiacritics(token)
    if (hasToken(en, token) || hasToken(tr, token) || hasToken(trFold, folded)) {
      score += token === query ? 3 : 1
    }
  }
  return score
}

export function pickByTopic(words: GroupableWord[], topic: string, count: number) {
  const ranked = words
    .map((word) => ({ word, score: topicScore(word, topic) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
  return ranked.slice(0, count).map((item) => item.word.id)
}
