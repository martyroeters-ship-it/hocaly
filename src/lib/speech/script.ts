import { composeTopicNarrative } from "@/lib/generate/narrative"
import { foldDiacritics, stripPunctuation } from "@/lib/turkish"
import type { CefrLevel, ListeningFormat, ListeningQuestion, ListeningSentence } from "@/lib/types"

export type ScriptWord = {
  id: string
  turkish: string
  english: string
  partOfSpeech?: string | null
}

const STORY_WORD_CAP = 8
const LIST_TR =
  /önemli\.?$|kullanıyorum|aklıma geliyor|hikayemin bir parçası|bu konuda önemli|Bugün kendimi biraz \S+ hissediyorum|Karşıda bir \S+ var\.?$|Biraz durup \S+\.?$|İnsanlar bugün \S+ görünüyor/i
const LIST_EN =
  /comes to mind|is part of my story|\bmatters\.?$|,\s*to [a-z]+|to adorn|^to [a-z]+[,.]|competition, contest/i

export function isListLikeListening(sentences: { turkish: string; english: string }[]) {
  if (!sentences.length) return true
  const flagged = sentences.filter((sentence) => {
    const turkish = sentence.turkish.trim()
    const english = sentence.english.trim()
    return LIST_TR.test(turkish) || LIST_EN.test(english)
  })
  if (flagged.length >= 2 || flagged.length / sentences.length >= 0.25) return true
  const glosses = sentences.filter((sentence) => /^(to [a-z]+|[A-Z][a-z]+, [a-z]+)\b/.test(sentence.english.trim()))
  return glosses.length >= 2
}

const DUMMY_TR = /önemli\.?$|kullanıyorum|aklıma geliyor|hikayemin bir parçası|bu konuda önemli/i
const DUMMY_EN = /comes to mind|is part of my story|\bmatters\.?$|to adorn|^to [a-z]+[,.]/i

export function isDummyStoryDump(sentences: { turkish: string; english: string }[]) {
  if (!sentences.length) return true
  const flagged = sentences.filter((sentence) => DUMMY_TR.test(sentence.turkish.trim()) || DUMMY_EN.test(sentence.english.trim()))
  if (flagged.length >= 2) return true
  const glosses = sentences.filter((sentence) => /^(to [a-z]+|[A-Z][a-z]+, [a-z]+)\b/.test(sentence.english.trim()))
  return glosses.length >= 2
}

const ACTIVITY = [
  { name: "writing", topic: /\b(letter|writing|yazmak|mektup)\b/i, sentence: /\b(harf|mektup|kalem|defter)\b|\byaz[ıi]yorum\b|I am writing a letter/i },
  { name: "cooking", topic: /\b(cook|kitchen|yemek|mutfak|pişir)/i, sentence: /\b(pişir|mutfak|tencere|tava)\b/i },
  { name: "shopping", topic: /\b(shop|market|alışveriş)/i, sentence: /\balışveriş yapıyorum\b/i },
  { name: "tennis", topic: /\b(tenis|tennis|kort)\b/i, sentence: /\b(tenis|kort|raket|servis)\b/i },
  { name: "school", topic: /\b(okul|school|class|ders)\b/i, sentence: /\b(okul|sınıf|öğretmen|ödev)\b/i },
  { name: "walk", topic: /\b(istanbul|morning walk|simit)\b/i, sentence: /\b(simit|vapur|cami)\b/i },
] as const

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function folded(text: string) {
  return foldDiacritics(stripPunctuation(text))
}

function contentTokens(text: string) {
  const stop = new Set(["bir", "bu", "su", "ve", "da", "de", "ile", "icin", "cok", "daha", "the", "and", "a", "an", "is", "am"])
  return new Set(
    folded(text)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stop.has(token)),
  )
}

function tokensOverlap(a: Set<string>, b: Set<string>) {
  for (const left of a) {
    for (const right of b) {
      if (left === right) return true
      if (left.length >= 4 && right.startsWith(left.slice(0, 4))) return true
      if (right.length >= 4 && left.startsWith(right.slice(0, 4))) return true
    }
  }
  return false
}

function hasNarrativeGlue(sentences: { turkish: string }[]) {
  const text = sentences.map((sentence) => sentence.turkish).join(" ")
  if (sentences.some((sentence) => wordCount(sentence.turkish) >= 9)) return true
  if (/[;:]/.test(text)) return true
  if (/\b(sonra|çünkü|cunku|fakat|bu yüzden|bu yuzden|o zaman|böylece|boylece)\b/i.test(text)) return true
  if (/\b\S{2,}(yip|yup|ip|up)\b/i.test(folded(text))) return true
  return false
}

function connectedPairCount(sentences: { turkish: string }[]) {
  let count = 0
  for (let i = 0; i < sentences.length - 1; i += 1) {
    const current = sentences[i]!
    const next = sentences[i + 1]!
    if (tokensOverlap(contentTokens(current.turkish), contentTokens(next.turkish))) count += 1
    else if (hasNarrativeGlue([next])) count += 1
  }
  return count
}

function isDisconnectedVocabDump(sentences: { turkish: string; english: string }[]) {
  if (sentences.length < 5) return false
  if (hasNarrativeGlue(sentences)) return false
  if (connectedPairCount(sentences) >= 2) return false
  const short = sentences.filter((sentence) => wordCount(sentence.turkish) <= 6)
  if (short.length < Math.max(5, Math.ceil(sentences.length * 0.8))) return false
  const leads = sentences.map((sentence) => folded(sentence.turkish).split(/\s+/)[0] || "")
  return new Set(leads.filter(Boolean)).size >= 4
}

export function isStoryDump(sentences: { turkish: string; english: string }[], topic = "") {
  if (isDummyStoryDump(sentences)) return true
  const topicActivity = ACTIVITY.find((item) => item.topic.test(topic) || item.topic.test(folded(topic)))
  if (topicActivity) {
    const jumped = sentences.some((sentence) =>
      ACTIVITY.some((item) => {
        if (item.name === topicActivity.name) return false
        if (item.name !== "writing" && item.name !== "cooking" && item.name !== "shopping") return false
        return item.sentence.test(sentence.turkish) || item.sentence.test(sentence.english) || item.sentence.test(folded(sentence.turkish))
      }),
    )
    if (jumped) return true
  }
  return isDisconnectedVocabDump(sentences)
}

export function fallbackListeningScript(options: {
  words: ScriptWord[]
  topic: string
  format: ListeningFormat
  durationSec: number
  cefr?: CefrLevel
}) {
  const storyWords = options.words.slice(0, options.cefr === "A1" ? 6 : STORY_WORD_CAP)
  const narrative = composeTopicNarrative({
    words: storyWords,
    topic: options.topic,
    cefr: options.cefr,
    maxTargetWords: 3,
  })
  const speakers = options.format === "conversation" ? ["Ada", "Deniz"] : [undefined]
  const sentences: ListeningSentence[] = narrative.sentences.map((sentence, index) => ({
    ...sentence,
    speaker: speakers[index % speakers.length],
  }))

  const turkish = sentences
    .map((sentence) => (sentence.speaker ? `${sentence.speaker}: ${sentence.turkish}` : sentence.turkish))
    .join(" ")
  const english = sentences
    .map((sentence) => (sentence.speaker ? `${sentence.speaker}: ${sentence.english}` : sentence.english))
    .join(" ")

  const usedWords = narrative.usedWords
  const heard = storyWords.filter((word) => usedWords.includes(word.turkish))
  const pool = heard.length ? heard : [{ id: "", turkish: "İstanbul", english: "Istanbul" }]
  const questions: ListeningQuestion[] = [
    {
      question: "What is this story mainly about?",
      answer: options.topic,
      choices: shuffleStable([options.topic, "A shopping list", "A grammar quiz", "The weather forecast"], 3),
    },
    ...heard.slice(0, 3).map((word, index) => {
      const distractors = pool.filter((item) => item.turkish !== word.turkish).slice(0, 3)
      const choices = [word.turkish, ...distractors.map((item) => item.turkish)]
      while (choices.length < 4) choices.push(pool[choices.length % pool.length]?.turkish ?? "evet")
      return {
        question: `Which word did you hear related to “${word.english}”?`,
        answer: word.turkish,
        choices: shuffleStable(choices, index),
      }
    }),
  ]

  const dictation = sentences.slice(0, 3).map((sentence) => ({
    turkish: sentence.turkish,
    english: sentence.english,
  }))

  const vocabPrompts: ListeningQuestion[] = pool.slice(0, 4).map((word, index) => ({
    question: `Did you hear “${word.turkish}” in the audio?`,
    answer: word.turkish,
    choices: shuffleStable(
      [word.turkish, ...pool.filter((item) => item.id !== word.id).slice(0, 3).map((item) => item.turkish)],
      index + 7,
    ),
  }))

  return {
    title: options.topic || "Listening story",
    sentences,
    turkish,
    english,
    questions,
    dictation,
    vocabPrompts,
    usedWords,
    omittedWords: options.words
      .map((word) => word.turkish)
      .filter((item) => !usedWords.includes(item)),
  }
}

function shuffleStable(items: string[], seed: number) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = (seed * 31 + i * 17) % (i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}
