import { composeTopicNarrative } from "@/lib/generate/narrative"
import {
  comitative1sg,
  containsWord,
  looksLikeVerb,
  normalizeTurkish,
  nounCase,
  presentContinuous1sg,
  turkishLower,
} from "@/lib/turkish"
import type { CefrLevel } from "@/lib/types"

export type GenerateWord = {
  turkish: string
  english: string
  partOfSpeech?: string | null
}

type Kind = "verb" | "adjective" | "time" | "place" | "person" | "expression" | "adverb" | "noun"

const TIME = new Set(["bugün", "yarın", "şimdi", "akşam", "sabah", "gece", "sonra", "her gün"])
const PLACES = new Set([
  "istanbul",
  "ankara",
  "izmir",
  "bursa",
  "antalya",
  "ev",
  "okul",
  "iş",
  "park",
  "restoran",
  "kafe",
  "şehir",
  "market",
  "üniversite",
  "sınıf",
])
const PEOPLE = new Set(["arkadaş", "aile", "anne", "baba", "öğretmen", "çocuk"])
const MOTION = new Set(["gitmek", "gelmek"])
const PERSON_AS_OBJECT = new Set(["anlamak", "sevmek", "görmek"])
const COLLOCATIONS: Record<string, { infinitive: string; ing: string; object: "indef" | "bare" }> = {
  kitap: { infinitive: "okumak", ing: "reading", object: "indef" },
  su: { infinitive: "içmek", ing: "drinking", object: "indef" },
  çay: { infinitive: "içmek", ing: "drinking", object: "indef" },
  kahve: { infinitive: "içmek", ing: "drinking", object: "indef" },
  tenis: { infinitive: "oynamak", ing: "playing", object: "bare" },
  futbol: { infinitive: "oynamak", ing: "playing", object: "bare" },
}
const PROGRESSIVE: Record<string, string> = {
  go: "going",
  come: "coming",
  understand: "understanding",
  read: "reading",
  play: "playing",
  drink: "drinking",
  eat: "eating",
  see: "seeing",
  like: "liking",
}

function sense(english: string) {
  return english.split(";")[0].replace(/^to\s+/i, "").trim()
}

function capitalize(text: string) {
  if (!text) return text
  return text[0]!.toUpperCase() + text.slice(1)
}

function isProper(word: string) {
  const first = [...word.trim()][0] ?? ""
  return Boolean(first) && first !== turkishLower(first)
}

function kindOf(word: GenerateWord): Kind {
  const t = normalizeTurkish(word.turkish)
  const pos = word.partOfSpeech
  if (pos === "verb" || looksLikeVerb(word.turkish)) return "verb"
  if (pos === "expression") return "expression"
  if (pos === "adjective") return "adjective"
  if (TIME.has(t)) return "time"
  if (pos === "adverb") return "adverb"
  if (PLACES.has(t) || isProper(word.turkish)) return "place"
  if (PEOPLE.has(t)) return "person"
  return "noun"
}

function progressive(english: string) {
  const base = sense(english)
  if (PROGRESSIVE[base]) return PROGRESSIVE[base]
  if (base.endsWith("e") && !base.endsWith("ee")) return `${base.slice(0, -1)}ing`
  return `${base}ing`
}

function conjugate(infinitive: string, english?: string) {
  return {
    tr: presentContinuous1sg(infinitive) ?? infinitive,
    en: progressive(english || infinitive),
  }
}

function locativeCopula(word: string) {
  const loc = nounCase(word, "locative")
  const front = /[eiöü]$/.test(loc)
  return `${loc}y${front ? "im" : "ım"}`
}

function finish(text: string) {
  const trimmed = text.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()
  if (!trimmed) return trimmed
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function composeScene(words: GenerateWord[]) {
  const buckets: Record<Kind, GenerateWord[]> = {
    verb: [],
    adjective: [],
    time: [],
    place: [],
    person: [],
    expression: [],
    adverb: [],
    noun: [],
  }
  for (const word of words) buckets[kindOf(word)].push(word)

  const used: { turkish: string; form: string }[] = []
  const mark = (word: GenerateWord, form: string) => {
    if (!used.some((item) => item.turkish === word.turkish)) used.push({ turkish: word.turkish, form })
  }

  const greet = buckets.expression.find((word) => ["merhaba", "teşekkürler"].includes(normalizeTurkish(word.turkish)))
  const please = [...buckets.adverb, ...buckets.expression].find((word) => normalizeTurkish(word.turkish) === "lütfen")
  const time = buckets.time[0]
  const place = buckets.place[0]
  const person = buckets.person[0]
  const adjectives = buckets.adjective
  const nouns = buckets.noun
  const motionVerb = buckets.verb.find((word) => MOTION.has(normalizeTurkish(word.turkish)))
  const objectVerb = buckets.verb.find((word) => PERSON_AS_OBJECT.has(normalizeTurkish(word.turkish)))
  const mainVerb = motionVerb ?? objectVerb ?? buckets.verb[0]
  const leftoverVerbs = buckets.verb.filter((word) => word !== mainVerb)

  const tr: string[] = []
  const enLead: string[] = []
  let verbTr = ""
  let verbEn = ""
  let objectTr = ""
  let objectEn = ""
  let placeTr = ""
  let placeEn = ""
  let personTr = ""
  let personEn = ""
  let copula = false
  let predAdj = false

  if (greet) {
    tr.push(`${greet.turkish},`)
    enLead.push(`${capitalize(sense(greet.english))},`)
    mark(greet, greet.turkish)
  }
  if (please) {
    tr.push("Lütfen")
    mark(please, "Lütfen")
  }
  if (time) {
    tr.push(time.turkish)
    enLead.push(capitalize(sense(time.english)))
    mark(time, time.turkish)
  }

  if (place && motionVerb) {
    placeTr = nounCase(place.turkish, "dative")
    placeEn = `to ${sense(place.english)}`
    mark(place, placeTr)
  } else if (place && adjectives.length && !nouns.length && !mainVerb) {
    placeTr = place.turkish
    placeEn = sense(place.english)
    predAdj = true
    mark(place, place.turkish)
  } else if (place && !nouns.length && !adjectives.length && !mainVerb && !person) {
    placeTr = locativeCopula(place.turkish)
    placeEn = `in ${sense(place.english)}`
    copula = true
    mark(place, placeTr)
  } else if (place) {
    placeTr = nounCase(place.turkish, "locative")
    placeEn = `in ${sense(place.english)}`
    mark(place, placeTr)
  }

  if (person && mainVerb && PERSON_AS_OBJECT.has(normalizeTurkish(mainVerb.turkish))) {
    personTr = nounCase(nounCase(person.turkish, "possessive1sg"), "accusative")
    personEn = `my ${sense(person.english)}`
    mark(person, personTr)
  } else if (person) {
    personTr = comitative1sg(person.turkish)
    personEn = `with my ${sense(person.english)}`
    mark(person, personTr)
  }

  if (nouns.length) {
    const head = nouns[0]!
    const rest = nouns.slice(1)
    const colloc = COLLOCATIONS[normalizeTurkish(head.turkish)]
    const adjTr = adjectives.map((word) => word.turkish).join(" ve ")
    const adjEn = adjectives.map((word) => sense(word.english)).join(" and ")
    for (const word of adjectives) mark(word, word.turkish)
    mark(head, head.turkish)
    if (colloc?.object === "bare") {
      objectTr = [adjTr, head.turkish].filter(Boolean).join(" ")
      objectEn = [adjEn, sense(head.english)].filter(Boolean).join(" ")
    } else {
      objectTr = adjTr ? `${adjTr} bir ${head.turkish}` : `bir ${head.turkish}`
      objectEn = adjEn ? `a ${adjEn} ${sense(head.english)}` : `a ${sense(head.english)}`
    }
    for (const extra of rest) {
      objectTr += ` ve ${extra.turkish}`
      objectEn += ` and ${sense(extra.english)}`
      mark(extra, extra.turkish)
    }
  } else if (predAdj && adjectives.length) {
    objectTr = adjectives.map((word) => word.turkish).join(" ve ")
    objectEn = adjectives.map((word) => sense(word.english)).join(" and ")
    for (const word of adjectives) mark(word, word.turkish)
  }

  if (mainVerb) {
    const form = conjugate(mainVerb.turkish, mainVerb.english)
    verbTr = form.tr
    verbEn = form.en
    mark(mainVerb, verbTr)
  } else if (nouns[0] && COLLOCATIONS[normalizeTurkish(nouns[0].turkish)]) {
    const colloc = COLLOCATIONS[normalizeTurkish(nouns[0].turkish)]!
    verbTr = conjugate(colloc.infinitive).tr
    verbEn = colloc.ing
  } else if (!copula && !predAdj) {
    verbTr = "görüyorum"
    verbEn = "looking at"
  }

  if (placeTr) tr.push(placeTr)
  if (personTr) tr.push(personTr)
  if (objectTr) tr.push(objectTr)
  if (verbTr && !copula && !predAdj) tr.push(verbTr)

  let english: string
  if (copula) {
    english = finish([...enLead, "I am", placeEn].filter(Boolean).join(" "))
  } else if (predAdj) {
    english = finish([placeEn || "It", "is", objectEn, time ? time.english.toLowerCase() : ""].filter(Boolean).join(" "))
  } else if (PERSON_AS_OBJECT.has(normalizeTurkish(mainVerb?.turkish ?? "")) && personEn) {
    english = finish([...enLead, "I", verbEn.replace(/ing$/, ""), personEn, objectEn, placeEn].filter(Boolean).join(" "))
  } else {
    english = finish([...enLead, "I am", verbEn, objectEn, placeEn, personEn].filter(Boolean).join(" "))
  }

  const omittedWords = leftoverVerbs.map((word) => word.turkish)
  for (const word of leftoverVerbs) {
    if (!used.some((item) => item.turkish === word.turkish)) omittedWords.push(word.turkish)
  }

  return {
    turkish: finish(tr.join(" ")),
    english,
    usedWords: used,
    omittedWords: [...new Set(omittedWords.filter((word) => !used.some((item) => item.turkish === word)))],
  }
}

export function fallbackCombinedSentence(words: GenerateWord[]) {
  const list = words.length ? words : [{ turkish: "bugün", english: "today", partOfSpeech: "adverb" }]
  return { ...composeScene(list), draft: true as const }
}

const CANNED_TITLE = /everyday life in istanbul|a morning in istanbul/i

function pickIndex(seed: number, length: number) {
  if (length <= 0) return 0
  return Math.abs(seed) % length
}

export function deriveStoryTopic(words: GenerateWord[], cefr: CefrLevel = "A2"): string {
  const place = words.find((word) => kindOf(word) === "place")
  const noun = words.find((word) => kindOf(word) === "noun")
  const adj = words.find((word) => kindOf(word) === "adjective")
  const verb = words.find((word) => kindOf(word) === "verb")
  if (place && noun) return `${capitalize(sense(noun.english))} at ${sense(place.english)}`
  if (place && adj) return `A ${sense(adj.english)} ${sense(place.english)}`
  if (noun && verb) return `${capitalize(progressive(verb.english))} a ${sense(noun.english)}`
  if (noun) return capitalize(sense(noun.english))
  if (place) return `At ${sense(place.english)}`
  if (adj) return capitalize(sense(adj.english))
  if (verb) return capitalize(sense(verb.english))
  if (words[0]) return capitalize(sense(words[0].english) || words[0].turkish)
  return `${cefr} story`
}

function storyTitle(words: GenerateWord[], topic: string, cefr: CefrLevel | undefined, seed: number, avoidTitle?: string) {
  const derived = deriveStoryTopic(words, cefr ?? "A2")
  const extras = [
    derived,
    words[0] ? capitalize(sense(words[0].english) || words[0].turkish) : derived,
    placeTitle(words, derived),
    `${cefr ?? "A2"}: ${derived}`,
  ]
  const unique = [...new Set(extras.filter((item) => item && !CANNED_TITLE.test(item)))]
  const typed = topic.trim()
  if (typed) {
    if (avoidTitle && normalizeTurkish(typed) === normalizeTurkish(avoidTitle)) {
      return unique.find((item) => normalizeTurkish(item) !== normalizeTurkish(avoidTitle)) || `${typed} (${(seed % 9) + 1})`
    }
    return typed
  }
  const chosen = unique[pickIndex(seed, unique.length)] || derived
  if (avoidTitle && normalizeTurkish(chosen) === normalizeTurkish(avoidTitle)) {
    return unique.find((item) => normalizeTurkish(item) !== normalizeTurkish(avoidTitle)) || `${derived} (${(seed % 9) + 1})`
  }
  return chosen
}

function placeTitle(words: GenerateWord[], fallback: string) {
  const place = words.find((word) => kindOf(word) === "place")
  if (!place) return fallback
  const other = words.find((word) => word !== place)
  if (!other) return `At ${sense(place.english)}`
  return `${capitalize(sense(other.english))} at ${sense(place.english)}`
}

export function fallbackStory(
  words: GenerateWord[],
  topic: string,
  cefr?: CefrLevel,
  options?: { seed?: number; avoidTitle?: string },
) {
  const list = words.length ? words.slice(0, 8) : [{ turkish: "bugün", english: "today", partOfSpeech: "adverb" }]
  const seed = options?.seed ?? 1
  const resolvedTopic = topic.trim() || deriveStoryTopic(list, cefr ?? "A2")
  const narrative = composeTopicNarrative({
    words: list,
    topic: resolvedTopic,
    cefr,
    maxTargetWords: 3,
    seed,
  })
  const sentences = narrative.sentences.map((item) => ({ turkish: item.turkish, english: item.english }))
  const turkish = sentences.map((item) => item.turkish).join(" ")
  const usedWords = list.filter((word) => containsWord(turkish, word.turkish)).map((word) => word.turkish)
  const omittedFromList = list.map((word) => word.turkish).filter((item) => !usedWords.includes(item))
  const title = storyTitle(list, resolvedTopic, cefr, seed, options?.avoidTitle)
  return {
    title,
    topic: topic.trim() || title,
    turkish,
    english: sentences.map((item) => item.english).join(" "),
    sentences,
    usedWords,
    omittedWords: [
      ...omittedFromList,
      ...words.map((word) => word.turkish).filter((item) => !list.some((word) => word.turkish === item)),
    ],
    questions: [
      {
        question: "Where does this short text take place, or what is happening?",
        answer: sentences[0]?.english ?? title,
      },
    ],
    grammarNotes: [] as { structure: string; explanation: string }[],
    draft: true as const,
  }
}
