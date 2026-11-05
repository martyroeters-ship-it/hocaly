import {
  GRAMMAR_DRILL_NOUNS,
  GRAMMAR_DRILL_VERBS,
  GRAMMAR_STRUCTURES,
  getStructure,
  type GrammarStructure,
} from "@/lib/grammar"
import type { CefrLevel } from "@/lib/types"

export type Person = "1sg" | "2sg" | "3sg" | "1pl" | "2pl" | "3pl"

export const PERSONS: Person[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"]

export const PERSON_LABEL: Record<Person, string> = {
  "1sg": "ben",
  "2sg": "sen",
  "3sg": "o",
  "1pl": "biz",
  "2pl": "siz",
  "3pl": "onlar",
}

export const PERSON_LABEL_EN: Record<Person, string> = {
  "1sg": "I",
  "2sg": "you (sg)",
  "3sg": "he/she",
  "1pl": "we",
  "2pl": "you (pl)",
  "3pl": "they",
}

/** Genitive pronouns used with possessed nouns (benim evim). */
export const GENITIVE_LABEL: Record<Person, string> = {
  "1sg": "benim",
  "2sg": "senin",
  "3sg": "onun",
  "1pl": "bizim",
  "2pl": "sizin",
  "3pl": "onların",
}

const CASE_LABEL: Record<string, string> = {
  plural: "plural",
  locative: "locative (in/at)",
  dative: "dative (to)",
  ablative: "ablative (from)",
  accusative: "accusative (the …)",
  genitive: "genitive (of)",
}

const POSSESSIVE_EN: Record<Person, string> = {
  "1sg": "my",
  "2sg": "your",
  "3sg": "his/her",
  "1pl": "our",
  "2pl": "your (pl)",
  "3pl": "their",
}

function lastVowel(text: string) {
  const chars = [...text.toLocaleLowerCase("tr-TR")]
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if ("aeıioöuü".includes(chars[i]!)) return chars[i]!
  }
  return "a"
}

function isFront(vowel: string) {
  return ["e", "i", "ö", "ü"].includes(vowel)
}

function isRounded(vowel: string) {
  return ["o", "ö", "u", "ü"].includes(vowel)
}

function fourWay(vowel: string) {
  if (isFront(vowel) && isRounded(vowel)) return "ü"
  if (isFront(vowel)) return "i"
  if (isRounded(vowel)) return "u"
  return "ı"
}

function twoWay(vowel: string) {
  return isFront(vowel) ? "e" : "a"
}

function endsVoiceless(stem: string) {
  return /[çkfptş]$/i.test(stem)
}

function yorPerson(person: Person, vowel: string) {
  const i = fourWay(vowel)
  const map: Record<Person, string> = {
    "1sg": `${i}m`,
    "2sg": `s${i}n`,
    "3sg": "",
    "1pl": `${i}z`,
    "2pl": `s${i}n${i}z`,
    "3pl": `l${twoWay(vowel)}r`,
  }
  return map[person]
}

function pastPerson(person: Person, vowel: string) {
  // After -di/-se the person marker is consonant-initial: -m -n -k -niz -ler
  const i = fourWay(vowel)
  const map: Record<Person, string> = {
    "1sg": `m`,
    "2sg": `n`,
    "3sg": "",
    "1pl": `k`,
    "2pl": `n${i}z`,
    "3pl": `l${twoWay(vowel)}r`,
  }
  return map[person]
}

function questionParticle(vowel: string) {
  const i = fourWay(vowel)
  return `m${i}`
}

function softMutate(stem: string) {
  if (stem.endsWith("p")) return `${stem.slice(0, -1)}b`
  if (stem.endsWith("ç")) return `${stem.slice(0, -1)}c`
  if (stem.endsWith("t") && stem.length > 2) return `${stem.slice(0, -1)}d`
  if (stem.endsWith("k") && stem.length > 2) {
    const before = stem.at(-2) ?? ""
    if ("aeıioöuü".includes(before)) return `${stem.slice(0, -1)}ğ`
    return `${stem.slice(0, -1)}g`
  }
  return stem
}

function bufferY(stem: string, suffix: string) {
  const last = stem.at(-1) ?? ""
  if ("aeıioöuü".includes(last) && "aeıioöuü".includes(suffix[0] ?? "")) {
    return `${stem}y${suffix}`
  }
  return `${stem}${suffix}`
}

function bufferS(stem: string, suffix: string) {
  const last = stem.at(-1) ?? ""
  if ("aeıioöuü".includes(last)) return `${stem}s${suffix}`
  return `${stem}${suffix}`
}

export function stripInfinitive(verb: string) {
  const n = verb.trim().toLocaleLowerCase("tr-TR")
  if (n.endsWith("mak") || n.endsWith("mek")) return n.slice(0, -3)
  return n
}

function progressiveStem(stem: string) {
  if (stem === "git") return "gid"
  if (stem === "et") return "ed"
  return stem
}

/** Soften for future (gidecek) but keep citation stem for negation (gitmeyecek). */
function futureStem(stem: string) {
  if (stem === "git") return "gid"
  if (stem === "et") return "ed"
  return stem
}

function presentContinuous(stem: string, person: Person) {
  let base = progressiveStem(stem)
  if (base === "de") base = "di"
  else if (base === "ye") base = "yi"
  // Low vowel stems: anla → anlıyor, söyle → söylüyor
  else if (/[ae]$/i.test(base)) {
    const withoutFinalVowel = base.slice(0, -1)
    base = `${withoutFinalVowel}${fourWay(lastVowel(withoutFinalVowel))}`
  }
  const v = lastVowel(base)
  const endsHighVowel = /[ıiuü]$/i.test(base)
  const link = endsHighVowel ? "" : fourWay(v)
  // Person endings after -yor always round to u/ü from the o in -yor → back u
  return `${base}${link}yor${yorPerson(person, "o")}`
}

function presentContinuousNeg(stem: string, person: Person) {
  // Keep citation stem: gitmiyorum (not gidmiyorum) — soft mutation is affirmative-only.
  const base = citationStemForNegation(stem)
  const v = lastVowel(base)
  // The negative suffix surfaces as four-way -mI before -yor:
  // gelmiyor, yapmıyor, okumuyor, konuşmuyor.
  const raised = `${base}m${fourWay(v)}`
  return `${raised}yor${yorPerson(person, "o")}`
}

function citationStemForNegation(stem: string) {
  // Affirmative softens git→gid / et→ed; negation must keep the citation stem.
  if (stem === "gid") return "git"
  if (stem === "ed") return "et"
  return stem
}

function simplePast(stem: string, person: Person) {
  const base = stem
  const v = lastVowel(base)
  const pastV = fourWay(v)
  const d = endsVoiceless(base) ? "t" : "d"
  return `${base}${d}${pastV}${pastPerson(person, pastV)}`
}

function simplePastNeg(stem: string, person: Person) {
  const base = citationStemForNegation(stem)
  const v = lastVowel(base)
  const neg = `${base}m${twoWay(v)}` // gelme / yapma
  const pastV = fourWay(lastVowel(neg))
  return `${neg}d${pastV}${pastPerson(person, pastV)}`
}

function attachFuturePerson(raw: string, person: Person) {
  if (person === "3sg") return raw
  const v = lastVowel(raw)
  // Soften k→ğ only before vowel-initial person endings (im/iz)
  if (person === "1sg" || person === "1pl") {
    const soft = raw.replace(/ak$/, "ağ").replace(/ek$/, "eğ")
    return `${soft}${yorPerson(person, v)}`
  }
  if (person === "3pl") return `${raw}l${twoWay(v)}r`
  return `${raw}${yorPerson(person, v)}`
}

function future(stem: string, person: Person) {
  const base = futureStem(stem)
  const v = lastVowel(base)
  const endsVowel = /[aeıioöuü]$/i.test(base)
  const linked = endsVowel ? `${base}y` : base
  const fut = twoWay(v) === "e" ? "ecek" : "acak"
  return attachFuturePerson(`${linked}${fut}`, person)
}

function futureNeg(stem: string, person: Person) {
  // Keep original stem: gitmeyecek (not gidmeyecek); always buffer y before -acak/-ecek
  const base = citationStemForNegation(stem)
  const v = lastVowel(base)
  const negV = twoWay(v)
  const raw = `${base}m${negV}y${negV}c${negV}k`
  return attachFuturePerson(raw, person)
}

/** Monosyllabic exceptions that take four-way aorist instead of regular -ar/-er. */
const AORIST_FOUR_WAY_EXCEPTIONS = new Set([
  "al",
  "bil",
  "bul",
  "dur",
  "gel",
  "gör",
  "kal",
  "ol",
  "öl",
  "san",
  "var",
  "ver",
  "vur",
])

function syllableCount(stem: string) {
  return [...stem.toLocaleLowerCase("tr-TR")].filter((char) => "aeıioöuü".includes(char)).length
}

function aorist(stem: string, person: Person) {
  // Soften only irregular verb stems (git→gid, et→ed); keep iç, etc.
  const base = progressiveStem(stem)
  const v = lastVowel(base)
  let aor: string
  if (/[aeıioöuü]$/i.test(base)) {
    aor = `${base}r` // oku-r, anla-r
  } else if (syllableCount(stem) === 1 && !AORIST_FOUR_WAY_EXCEPTIONS.has(stem)) {
    aor = `${base}${twoWay(v)}r` // yapar, sever, gider, içer
  } else {
    aor = `${base}${fourWay(v)}r` // gelir, görür; konuşur, çalışır
  }
  if (person === "3sg") return aor
  return `${aor}${yorPerson(person, lastVowel(aor))}`
}

function aoristNeg(stem: string, person: Person) {
  const base = citationStemForNegation(stem)
  const v = lastVowel(base)
  const neg = `${base}m${twoWay(v)}`
  if (person === "3sg") return `${neg}z`
  // 1sg: gelmem; 1pl: gelmeyiz (not *gelmeziz); others: gelmezsin…
  if (person === "1sg") return `${neg}m`
  if (person === "1pl") return bufferY(neg, yorPerson("1pl", lastVowel(neg)))
  const withZ = `${neg}z`
  return `${withZ}${yorPerson(person, lastVowel(withZ))}`
}

function reportedPast(stem: string, person: Person) {
  const base = stem
  const v = lastVowel(base)
  const m = `${base}m${fourWay(v)}ş`
  if (person === "3sg") return m
  return `${m}${yorPerson(person, lastVowel(m))}`
}

function reportedPastNeg(stem: string, person: Person) {
  const base = stem
  const v = lastVowel(base)
  const neg = `${base}m${twoWay(v)}`
  const m = `${neg}m${fourWay(lastVowel(neg))}ş`
  if (person === "3sg") return m
  return `${m}${yorPerson(person, lastVowel(m))}`
}

/** Predicative person endings (-im/-sin…); insert buffer y after a vowel stem. */
function attachPredicativePerson(stem: string, person: Person) {
  if (person === "3sg") return stem
  return bufferY(stem, yorPerson(person, lastVowel(stem)))
}

function ability(stem: string, person: Person) {
  // Soften before -ebil: git → gidebilir (not gitebilir); iç stays içebilir
  const base = futureStem(stem)
  const v = lastVowel(base)
  const endsVowel = /[aeıioöuü]$/i.test(base)
  const abil = `${base}${endsVowel ? "y" : ""}${isFront(v) ? "ebil" : "abil"}`
  // -abilir/-ebilir + aorist -ir (consonant-final) — no buffer y before person
  const aor = `${abil}ir`
  return attachPredicativePerson(aor, person)
}

function inability(stem: string, person: Person) {
  const base = futureStem(stem)
  const v = lastVowel(base)
  const endsVowel = /[aeıioöuü]$/i.test(base)
  const neg = `${base}${endsVowel ? "y" : ""}${isFront(v) ? "eme" : "ama"}`
  // Raise final a/e of -ama/-eme before -yor: geleme→gelemiyor, yapama→yapamıyor
  const raised = `${neg.slice(0, -1)}${fourWay(lastVowel(neg))}`
  return `${raised}yor${yorPerson(person, "o")}`
}

function necessity(stem: string, person: Person) {
  const base = stem
  const v = lastVowel(base)
  const nec = `${base}m${isFront(v) ? "eli" : "alı"}`
  return attachPredicativePerson(nec, person)
}

function zorunda(stem: string, person: Person) {
  const inf = stem.endsWith("a") || stem.endsWith("ı") || stem.endsWith("o") || stem.endsWith("u") ? `${stem}mak` : `${stem}mek`
  // Approximate infinitive from stem vowel
  const v = lastVowel(stem)
  const infinitive = `${stem}m${twoWay(v)}k`
  const cop: Record<Person, string> = {
    "1sg": "yım",
    "2sg": "sın",
    "3sg": "",
    "1pl": "yız",
    "2pl": "sınız",
    "3pl": "lar",
  }
  // vowel harmony for copula after zorunda (a)
  const map: Record<Person, string> = {
    "1sg": "yım",
    "2sg": "sın",
    "3sg": "",
    "1pl": "yız",
    "2pl": "sınız",
    "3pl": "lar",
  }
  void inf
  void cop
  return `${infinitive} zorunda${map[person]}`
}

function suggestion(stem: string) {
  // Soften + buffer-y: gidelim, anlayalım, okuyalım
  const base = progressiveStem(stem)
  const v = lastVowel(base)
  return bufferY(base, isFront(v) ? "elim" : "alım")
}

function conditional(stem: string, person: Person) {
  const v = lastVowel(stem)
  const cond = `${stem}s${twoWay(v)}`
  return `${cond}${pastPerson(person, twoWay(v))}`
}

function polarQuestion(thirdPersonForm: string, person: Person) {
  const v = lastVowel(thirdPersonForm)
  const mi = questionParticle(v)
  const i = fourWay(v)
  if (person === "3sg") return `${thirdPersonForm} ${mi}?`
  if (person === "3pl") {
    // Harmony from the plural form itself: geliyorlar mı? (not … mu?)
    const plural = `${thirdPersonForm}l${twoWay(v)}r`
    return `${plural} ${questionParticle(lastVowel(plural))}?`
  }
  const map: Record<Person, string> = {
    "1sg": `${mi}y${i}m`,
    "2sg": `${mi}s${i}n`,
    "3sg": mi,
    "1pl": `${mi}y${i}z`,
    "2pl": `${mi}s${i}n${i}z`,
    "3pl": mi,
  }
  return `${thirdPersonForm} ${map[person]}?`
}

function pastPolarQuestion(stem: string, person: Person) {
  const form = simplePast(stem, person)
  const mi = questionParticle(lastVowel(form))
  return `${form} ${mi}?`
}

function nounCase(stem: string, kind: "locative" | "dative" | "ablative" | "accusative" | "genitive" | "plural") {
  let base = stem
  const v = lastVowel(base)
  if (kind === "plural") return `${base}l${twoWay(v)}r`
  if (["accusative", "dative", "genitive"].includes(kind)) base = softMutate(base)
  if (kind === "locative") {
    const d = endsVoiceless(base) ? "t" : "d"
    return `${base}${d}${twoWay(v)}`
  }
  if (kind === "ablative") {
    const d = endsVoiceless(base) ? "t" : "d"
    return `${base}${d}${twoWay(v)}n`
  }
  if (kind === "dative") {
    return bufferY(base, twoWay(v))
  }
  if (kind === "accusative") {
    return bufferY(base, fourWay(v))
  }
  if (kind === "genitive") {
    const last = base.at(-1) ?? ""
    const n = "aeıioöuü".includes(last) ? "n" : ""
    return `${base}${n}${fourWay(v)}n`
  }
  return base
}

function possessiveSuffix(stem: string, person: Person) {
  // onların evi — noun takes 3sg possessive after onların
  if (person === "3pl") return possessiveSuffix(stem, "3sg")
  const base = softMutate(stem)
  const v = lastVowel(base)
  const i = fourWay(v)
  const last = base.at(-1) ?? ""
  const endsVowel = "aeıioöuü".includes(last)
  // Vowel stems take buffer -y-: su → suyum, araba → arabam (a+m, no y for a/ı/u/ü? 
  // Actually: araba-m, su-yum, kedi-yim — y after the stem vowel before person vowel.
  // Common rule: if stem ends in vowel, 1sg/2sg/1pl/2pl use -y- before vowel-initial suffixes;
  // but -m/-n after a/ı/u/ü/o/ö often attach directly for a-class: arabam, not arabayım.
  // Textbook: araba→arabam/araban/arabası; su→suyum/suyun/suyu; kedi→kedim is consonant... 
  // su ends with u → suyum (y buffer). araba ends with a → arabam (no y for 1sg/2sg).
  if (endsVowel) {
    // arabam / kapım / kedim vs suyum / neyim
    const needsY = "oöuü".includes(last) || last === "e" && base.length <= 2
    const y = needsY ? "y" : ""
    const map: Record<Person, string> = {
      "1sg": needsY ? `${y}${i}m` : `m`,
      "2sg": needsY ? `${y}${i}n` : `n`,
      "3sg": `s${i}`,
      "1pl": needsY ? `${y}${i}m${i}z` : `m${i}z`,
      "2pl": needsY ? `${y}${i}n${i}z` : `n${i}z`,
      "3pl": `s${i}`,
    }
    if (person === "3sg" || person === "3pl") {
      // su → suyu; araba → arabası
      if ("oöuü".includes(last)) return `${base}y${i}`
      return bufferS(base, i)
    }
    return `${base}${map[person]}`
  }
  return `${base}${
    (
      {
        "1sg": `${i}m`,
        "2sg": `${i}n`,
        "3sg": `${i}`,
        "1pl": `${i}m${i}z`,
        "2pl": `${i}n${i}z`,
        "3pl": `${i}`,
      } as Record<Person, string>
    )[person]
  }`
}

/** Full possessive phrase: benim evim, senin evin, … */
export function possessivePhrase(stem: string, person: Person) {
  return `${GENITIVE_LABEL[person]} ${possessiveSuffix(stem, person)}`
}

function possessive(stem: string, person: Person) {
  return possessiveSuffix(stem, person)
}

/** Core conjugator for a structure id + stem + person. */
export function conjugateForm(structureId: string, stem: string, person: Person): string | null {
  const base = stem.trim()
  if (!base) return null

  switch (structureId) {
    case "present-continuous":
      return presentContinuous(base, person)
    case "present-continuous-negation":
    case "negative":
      return presentContinuousNeg(base, person)
    case "present-continuous-questions":
      return polarQuestion(presentContinuous(base, "3sg"), person)
    case "simple-past":
      return simplePast(base, person)
    case "simple-past-negation":
      return simplePastNeg(base, person)
    case "simple-past-questions":
      return pastPolarQuestion(base, person)
    case "future":
      return future(base, person)
    case "future-negation":
      return futureNeg(base, person)
    case "future-questions":
      return polarQuestion(future(base, "3sg"), person)
    case "aorist":
      return aorist(base, person)
    case "aorist-negation":
      return aoristNeg(base, person)
    case "aorist-questions":
      return polarQuestion(aorist(base, "3sg"), person)
    case "reported-past":
      return reportedPast(base, person)
    case "reported-past-negation":
      return reportedPastNeg(base, person)
    case "reported-past-questions":
      return polarQuestion(reportedPast(base, "3sg"), person)
    case "ability":
      return ability(base, person)
    case "inability":
    case "neg-ability":
      return inability(base, person)
    case "necessity":
      return necessity(base, person)
    case "obligation-zorunda":
      return zorunda(base, person)
    case "suggestion-lets":
      return suggestion(base)
    case "basic-conditional":
    case "conditional":
      return conditional(base, person)
    case "imperative": {
      if (person === "2sg") return base
      if (person === "2pl") {
        // Soften + buffer-y: gidin, anlayın, okuyun
        const stem2 = progressiveStem(base)
        return bufferY(stem2, `${fourWay(lastVowel(stem2))}n`)
      }
      if (person === "3sg") {
        const v = lastVowel(base)
        return `${base}s${fourWay(v)}n` // gelsin / yapsın
      }
      return null
    }
    case "basic-verb-negation": {
      if (person === "2sg") return `${base}m${twoWay(lastVowel(base))}`
      if (person === "2pl") return `${base}m${twoWay(lastVowel(base))}${isFront(lastVowel(base)) ? "yin" : "yın"}`
      return presentContinuousNeg(base, person)
    }
    case "infinitives":
      return `${base}m${twoWay(lastVowel(base))}k`
    case "verbal-nouns":
      return `${base}m${twoWay(lastVowel(base))}`
    case "verbal-nouns-possessive":
      return possessive(`${base}m${twoWay(lastVowel(base))}`, person)
    case "purpose-mak-icin":
      return `${base}m${twoWay(lastVowel(base))}k için`
    case "before-doing": {
      // -madan/-meden önce (two-way on both vowels)
      const negV = twoWay(lastVowel(base))
      return `${base}m${negV}d${negV}n önce`
    }
    case "after-doing": {
      // -dıktan/-dikten sonra — harmony from the past stem
      const past = simplePast(base, "3sg")
      return `${past}kt${twoWay(lastVowel(past))}n sonra`
    }
    case "while-doing":
      return `${aorist(base, "3sg")}ken`
    case "by-doing": {
      const stem2 = progressiveStem(base)
      return bufferY(stem2, isFront(lastVowel(stem2)) ? "erek" : "arak")
    }
    case "without-doing": {
      const negV = twoWay(lastVowel(base))
      return `${base}m${negV}d${negV}n`
    }
    case "basic-participles":
    case "participles": {
      // Buffer-y + soft irregulars: anlayan, okuyan, giden
      const stem2 = progressiveStem(base)
      return bufferY(stem2, isFront(lastVowel(stem2)) ? "en" : "an")
    }
    case "plural":
      return nounCase(base, "plural")
    case "locative":
      return nounCase(base, "locative")
    case "dative":
      return nounCase(base, "dative")
    case "ablative":
      return nounCase(base, "ablative")
    case "accusative":
      return nounCase(base, "accusative")
    case "genitive":
      return nounCase(base, "genitive")
    case "possessive-suffixes":
    case "possessive":
      return possessive(base, person)
    case "basic-indirect-speech": {
      // Four-way: yaptığını / geldiğini / okuduğunu / gördüğünü
      const past = simplePast(base, "3sg")
      const i = fourWay(lastVowel(past))
      return `${past}ğ${i}n${i}`
    }
    case "reciprocal-verbs":
    case "reflexive-verbs":
    case "basic-passive":
    case "passive":
    case "basic-causative":
    case "causative":
      // Lexically restricted — not productive on arbitrary drill verbs.
      // Static curated examples live on the structure; drills use those headwords.
      return null
    default:
      return null
  }
}

export function conjugate(structureId: string, stem: string, person: Person): string | null {
  return conjugateForm(structureId, stem, person)
}

export type ParadigmForm = { person: Person; label: string; turkish: string }

export function buildParadigm(structureId: string, infinitiveOrNoun: string): ParadigmForm[] {
  const structure = getStructure(structureId)
  const isNoun =
    structure?.category === "case" ||
    structure?.category === "noun" ||
    ["plural", "locative", "dative", "ablative", "accusative", "genitive", "possessive-suffixes"].includes(structureId)

  const stem = isNoun ? infinitiveOrNoun.trim().toLocaleLowerCase("tr-TR") : stripInfinitive(infinitiveOrNoun)
  if (!stem) return []

  if (structureId === "imperative" || structureId === "basic-verb-negation" || structureId === "suggestion-lets") {
    const persons: Person[] =
      structureId === "suggestion-lets" ? ["1pl"] : structureId === "imperative" ? ["2sg", "2pl", "3sg"] : ["2sg", "2pl"]
    return persons
      .map((person) => {
        const turkish = conjugate(structureId, stem, person)
        return turkish ? { person, label: PERSON_LABEL[person], turkish } : null
      })
      .filter(Boolean) as ParadigmForm[]
  }

  if (structureId === "possessive-suffixes" || structureId === "possessive") {
    // Left column already shows the genitive cue (benim); right is the form alone (evim).
    return PERSONS.map((person) => ({
      person,
      label: GENITIVE_LABEL[person],
      turkish: possessiveSuffix(stem, person),
    }))
  }

  if (isNoun && structureId !== "verbal-nouns-possessive") {
    const turkish = conjugate(structureId, stem, "3sg")
    const label = CASE_LABEL[structureId] ?? stem
    return turkish ? [{ person: "3sg", label, turkish }] : []
  }

  // Non-person forms (infinitive, participles, converbs)
  if (
    [
      "infinitives",
      "verbal-nouns",
      "purpose-mak-icin",
      "before-doing",
      "after-doing",
      "while-doing",
      "by-doing",
      "without-doing",
      "basic-participles",
      "basic-indirect-speech",
    ].includes(structureId)
  ) {
    const turkish = conjugate(structureId, stem, "3sg")
    return turkish ? [{ person: "3sg", label: infinitiveOrNoun, turkish }] : []
  }

  return PERSONS.map((person) => {
    const turkish = conjugate(structureId, stem, person)
    if (!turkish) return null
    // Left column already shows the person cue; right is the conjugated form alone.
    return { person, label: PERSON_LABEL[person], turkish }
  }).filter(Boolean) as ParadigmForm[]
}

/**
 * Pedagogical build path for a headword on a structure, e.g.
 * gelmek → gel → geldik → geldikten → geldikten sonra
 */
export function buildFormulationChain(
  structureId: string,
  headword: string,
  formTurkish?: string,
): string | null {
  const structure = getStructure(structureId)
  const isNoun =
    structure?.category === "case" ||
    structure?.category === "noun" ||
    ["plural", "locative", "dative", "ablative", "accusative", "genitive", "possessive-suffixes"].includes(
      structureId,
    )
  const stem = isNoun ? headword.trim().toLocaleLowerCase("tr-TR") : stripInfinitive(headword)
  if (!stem) return null
  const lemma = isNoun ? stem : headword.trim().toLocaleLowerCase("tr-TR") || `${stem}mek`
  const conjugated = conjugate(structureId, stem, "3sg")
  const final = (formTurkish?.trim() || conjugated || "").toLocaleLowerCase("tr-TR")
  if (!final) return null

  const steps = (parts: string[]) => parts.filter(Boolean).join(" → ")

  switch (structureId) {
    case "after-doing": {
      // Taught as -dik participle + -ten + sonra (looks like 1pl past).
      const dik = simplePast(stem, "1pl")
      const dikten = `${dik}t${twoWay(lastVowel(dik))}n`
      return steps([lemma, stem, dik, dikten, conjugated ?? final])
    }
    case "before-doing": {
      const negV = twoWay(lastVowel(stem))
      const madan = `${stem}m${negV}d${negV}n`
      return steps([lemma, stem, madan, conjugated ?? final])
    }
    case "while-doing": {
      const aor = aorist(stem, "3sg")
      return steps([lemma, stem, aor, conjugated ?? final])
    }
    case "by-doing": {
      const soft = progressiveStem(stem)
      const erek = bufferY(soft, isFront(lastVowel(soft)) ? "erek" : "arak")
      return steps([lemma, stem, soft !== stem ? soft : "", erek].filter(Boolean) as string[])
    }
    case "without-doing": {
      const negV = twoWay(lastVowel(stem))
      return steps([lemma, stem, `${stem}m${negV}d${negV}n`])
    }
    case "purpose-mak-icin": {
      const inf = `${stem}m${twoWay(lastVowel(stem))}k`
      return steps([lemma, stem, inf, conjugated ?? final])
    }
    case "infinitives":
      return steps([stem, final])
    case "verbal-nouns":
      return steps([lemma, stem, final])
    case "basic-participles": {
      const soft = progressiveStem(stem)
      return steps([lemma, stem, soft !== stem ? soft : stem, final])
    }
    case "present-continuous":
    case "present-continuous-negation":
    case "simple-past":
    case "simple-past-negation":
    case "future":
    case "future-negation":
    case "aorist":
    case "aorist-negation":
    case "reported-past":
    case "reported-past-negation":
    case "ability":
    case "inability":
    case "necessity":
      return steps([lemma, stem, final])
    case "present-continuous-questions":
    case "simple-past-questions":
    case "future-questions":
    case "aorist-questions":
    case "reported-past-questions": {
      const baseId = structureId.replace(/-questions$/, "")
      const baseForm = conjugate(baseId, stem, "3sg")
      return baseForm ? steps([lemma, stem, baseForm, final]) : steps([lemma, stem, final])
    }
    case "plural":
    case "locative":
    case "dative":
    case "ablative":
    case "accusative":
    case "genitive":
      return steps([stem, final])
    case "possessive-suffixes":
      return steps([stem, formTurkish?.trim() || possessiveSuffix(stem, "1sg")])
    default:
      return final !== lemma && final !== stem ? steps([lemma, stem, final]) : null
  }
}

export function exampleParadigmsForStructure(structureId: string) {
  const structure = getStructure(structureId)
  if (!structure) return []

  if (structure.examples.length) {
    return structure.examples.map((example) => ({
      headword: example.verb,
      english: example.english,
      forms: example.forms,
    }))
  }

  if (!structure.conjugable) return []

  const isNoun =
    structure.category === "case" ||
    structure.category === "noun" ||
    ["plural", "locative", "dative", "ablative", "accusative", "genitive", "possessive-suffixes"].includes(structureId)

  const words = isNoun
    ? GRAMMAR_DRILL_NOUNS.slice(0, 3).map((item) => ({ turkish: item.turkish, english: item.english }))
    : GRAMMAR_DRILL_VERBS.slice(0, 3).map((item) => ({ turkish: item.turkish, english: item.english }))

  return words.map((word) => ({
    headword: word.turkish,
    english: word.english,
    forms: buildParadigm(structureId, word.turkish).map((form) => ({
      label: form.label,
      turkish: form.turkish,
    })),
  }))
}

export type DrillKind = "translate" | "blank" | "sentence" | "error-correction"

export type ConjugationPrompt = {
  structureId: string
  structureLabel: string
  verb: string
  verbEnglish: string
  person: Person
  personLabel: string
  promptEnglish: string
  expected: string
  accepted: string[]
  sentenceCue: string
  kind?: DrillKind
  turkishPrompt?: string
  englishPrompt?: string
  /** When true, grading should not hurt mastery (weak validation / ambiguous cue). */
  uncertainKey?: boolean
  /** Wrong form shown for error-correction drills. */
  brokenForm?: string
}

/** First usable English verb sense: "to do / make" → "do"; "to read → okutmak" → "read". */
export function primaryGlossVerb(verbEnglish: string): string {
  let raw = verbEnglish.replace(/^to\s+/i, "").trim() || verbEnglish.trim()
  raw = raw.split(/\s*→\s*/)[0]?.trim() || raw
  raw = raw.split(/\s*\/\s*/)[0]?.trim() || raw
  // Drop trailing parenthetical notes: "meet (each other)" kept; strip "lexical" tags elsewhere
  return raw.replace(/\s*\(lexical\)\s*/gi, "").trim() || "do"
}

function beAux(person: Person) {
  if (person === "1sg") return "am"
  if (person === "3sg") return "is"
  return "are"
}

function doAux(person: Person) {
  return person === "3sg" ? "does" : "do"
}

function simplePastEn(verb: string) {
  const irregular: Record<string, string> = {
    go: "went",
    come: "came",
    do: "did",
    make: "made",
    read: "read",
    write: "wrote",
    speak: "spoke",
    drink: "drank",
    look: "looked",
    understand: "understood",
    work: "worked",
    study: "studied",
    get: "got",
    see: "saw",
    meet: "met",
    wash: "washed",
    dress: "dressed",
    comb: "combed",
    correspond: "corresponded",
  }
  if (irregular[verb]) return irregular[verb]
  if (verb.endsWith("e")) return `${verb}d`
  if (/[^aeiou]y$/i.test(verb)) return `${verb.slice(0, -1)}ied`
  return `${verb}ed`
}

function gerundEn(verb: string) {
  if (verb.endsWith("e") && !verb.endsWith("ee")) return `${verb.slice(0, -1)}ing`
  return `${verb}ing`
}

const CAUSATIVE_IDS = new Set(["basic-causative", "causative"])
const PASSIVE_IDS = new Set(["basic-passive", "passive"])
const RECIPROCAL_IDS = new Set(["reciprocal-verbs"])
const REFLEXIVE_IDS = new Set(["reflexive-verbs"])

/** Structures where the expected answer may legitimately be an infinitive / bare stem. */
const ALLOWS_LEMMA_EXPECTED = new Set(["infinitives", "verbal-nouns", "purpose-mak-icin"])

/**
 * True when expected is just the citation infinitive or bare stem — invalid for tensed/mood drills.
 */
export function isBareLemmaExpected(structureId: string, expected: string, verbTurkish: string): boolean {
  if (ALLOWS_LEMMA_EXPECTED.has(structureId)) return false
  const exp = expected.trim().toLocaleLowerCase("tr-TR").replace(/[?!]+$/g, "")
  if (!exp) return true
  const verb = verbTurkish.trim().toLocaleLowerCase("tr-TR")
  const stem = stripInfinitive(verb)
  if (exp === verb) return true
  if (stem && exp === stem) return true
  return false
}

/** English gloss of intended meaning for a conjugated form (reduces bare Biz ______ ambiguity). */
export function englishGlossForForm(options: {
  structureId: string
  verbEnglish: string
  person: Person
  nounEnglish?: string
}): string {
  const person = PERSON_LABEL_EN[options.person]
  const verb = primaryGlossVerb(options.verbEnglish)
  const id = options.structureId
  const noun = options.nounEnglish ?? verb
  const past = simplePastEn(verb)
  const ing = gerundEn(verb)

  if (id === "possessive-suffixes" || id === "possessive") {
    return `${POSSESSIVE_EN[options.person]} ${noun}`
  }
  if (id === "plural") return `the ${noun}s`
  if (id === "locative") return `in/at the ${noun}`
  if (id === "dative") return `to the ${noun}`
  if (id === "ablative") return `from the ${noun}`
  if (id === "accusative") return `the ${noun}`
  if (id === "genitive") return `of the ${noun}`

  // Voice (curated lexical stems)
  if (CAUSATIVE_IDS.has(id)) {
    return `${person} made someone ${verb}.`
  }
  if (PASSIVE_IDS.has(id)) {
    const pp: Record<string, string> = {
      do: "done",
      make: "made",
      write: "written",
      read: "read",
      speak: "spoken",
      drink: "drunk",
      understand: "understood",
      see: "seen",
      look: "looked at",
      go: "gone to",
      come: "come to",
      work: "worked",
    }
    return `It was ${pp[verb] ?? `${verb}ed`}.`
  }
  if (RECIPROCAL_IDS.has(id)) {
    return `${person} ${beAux(options.person)} ${ing} each other.`
  }
  if (REFLEXIVE_IDS.has(id)) {
    const refl: Record<Person, string> = {
      "1sg": "myself",
      "2sg": "yourself",
      "3sg": "himself/herself",
      "1pl": "ourselves",
      "2pl": "yourselves",
      "3pl": "themselves",
    }
    return `${person} ${beAux(options.person)} ${ing} ${refl[options.person]}.`
  }

  // Questions (check before base tense so -questions ids don't lose the ?)
  if (id.includes("question")) {
    if (id.includes("present-continuous")) {
      return `${beAux(options.person) === "am" ? "Am" : beAux(options.person) === "is" ? "Is" : "Are"} ${person.toLowerCase()} ${ing} right now?`
        .replace(/^Am i /, "Am I ")
        .replace(/^Is he\/she /, "Is he/she ")
        .replace(/^Are you \(sg\) /, "Are you ")
        .replace(/^Are you \(pl\) /, "Are you ")
        .replace(/^Are we /, "Are we ")
        .replace(/^Are they /, "Are they ")
    }
    if (id.includes("simple-past")) return `Did ${person.toLowerCase()} ${verb}?`.replace(/^Did i /, "Did I ")
    if (id.includes("future")) return `Will ${person.toLowerCase()} ${verb}?`.replace(/^Will i /, "Will I ")
    if (id.includes("aorist")) {
      const aux = doAux(options.person)
      return `${aux === "does" ? "Does" : "Do"} ${person.toLowerCase()} usually ${verb}?`
        .replace(/^Do i /, "Do I ")
        .replace(/^Does he\/she /, "Does he/she ")
    }
    if (id.includes("reported-past")) return `Did ${person.toLowerCase()} apparently ${verb}?`.replace(/^Did i /, "Did I ")
    return `Does ${person.toLowerCase()} ${verb}?`.replace(/^Does i /, "Do I ")
  }

  // Negation + tense
  if (id.includes("present-continuous") && id.includes("negation")) {
    return `${person} ${beAux(options.person)} not ${ing} right now.`
  }
  if (id.includes("present-continuous")) {
    return `${person} ${beAux(options.person)} ${ing} right now.`
  }
  if (id.includes("simple-past") && id.includes("negation")) {
    return `${person} did not ${verb}.`
  }
  if (id.includes("simple-past")) {
    return `${person} ${past}.`
  }
  if (id === "reported-past-negation" || (id.includes("reported-past") && id.includes("negation"))) {
    return `Apparently ${person.toLowerCase()} did not ${verb}.`.replace(/^Apparently i /, "Apparently I ")
  }
  if (id === "reported-past" || id.includes("reported-past")) {
    return `Apparently ${person.toLowerCase()} ${past}.`.replace(/^Apparently i /, "Apparently I ")
  }
  if (id.includes("future") && id.includes("negation")) {
    return `${person} will not ${verb}.`
  }
  if (id.includes("future")) {
    return `${person} will ${verb}.`
  }
  if (id.includes("aorist") && id.includes("negation")) {
    return `${person} usually ${doAux(options.person)} not ${verb}.`
  }
  if (id.includes("aorist")) {
    // Habitual cue so English simple present is not read as present continuous.
    if (options.person !== "3sg") return `${person} usually ${verb}.`
    if (verb === "go") return `${person} usually goes.`
    if (verb === "do") return `${person} usually does.`
    if (verb.endsWith("y") && verb.length > 2 && !/[aeiou]y$/i.test(verb)) {
      return `${person} usually ${verb.slice(0, -1)}ies.`
    }
    if (verb.endsWith("s") || verb.endsWith("sh") || verb.endsWith("ch") || verb.endsWith("x")) {
      return `${person} usually ${verb}es.`
    }
    return `${person} usually ${verb}s.`
  }

  if (id === "ability") return `${person} can ${verb}.`
  if (id === "inability" || id === "neg-ability") return `${person} cannot ${verb}.`
  if (id === "necessity") return `${person} must ${verb}.`
  if (id === "obligation-zorunda" || id.includes("zorunda")) {
    return `${person} ${beAux(options.person)} obliged to ${verb}.`
  }
  if (id === "imperative") {
    if (options.person === "3sg") return `Let him/her ${verb}.`
    if (options.person === "2pl") return `${verb[0]!.toUpperCase()}${verb.slice(1)} (plural/polite)!`
    return `${verb[0]!.toUpperCase()}${verb.slice(1)}!`
  }
  if (id === "suggestion-lets") return `Let's ${verb}.`
  if (id.includes("conditional")) return `If ${person.toLowerCase()} ${verb}…`.replace(/^If i /, "If I ")
  if (id === "basic-verb-negation") {
    if (options.person === "2sg" || options.person === "2pl") return `Don't ${verb}!`
    return `${person} ${beAux(options.person)} not ${ing}.`
  }

  // Non-finite / converbs / participles
  if (id === "infinitives") return `to ${verb}`
  if (id === "verbal-nouns") return `${ing}`
  if (id === "verbal-nouns-possessive") {
    return `${POSSESSIVE_EN[options.person]} ${ing}`
  }
  if (id === "purpose-mak-icin") return `in order to ${verb}`
  if (id === "before-doing") return `before ${ing}`
  if (id === "after-doing") return `after ${ing}`
  if (id === "while-doing") return `while ${ing}`
  if (id === "by-doing") return `by ${ing}`
  if (id === "without-doing") return `without ${ing}`
  if (id === "basic-participles" || id === "participles") return `who/that ${verb}s`
  if (id === "basic-indirect-speech") return `that he/she ${past}`

  // Ambiguous leftover — caller should set uncertainKey; never emit "person: verb"
  return `${person} ${verb} (form unclear).`
}

/** Mutate a correct form into a plausible wrong answer for error-correction. */
export function mutateWrongForm(expected: string): string {
  const form = expected.trim()
  if (!form) return form

  // Prefer soft-g collapse ğ→k (a real learner mistake we already reject)
  if (form.includes("ğ")) {
    return form.replace(/ğ/g, "k")
  }

  // Vowel-harmony slips on common converb / case endings (yapmadan → yapmaden)
  const harmonySlips: Array<[RegExp, string]> = [
    [/madan$/iu, "maden"],
    [/meden$/iu, "madan"],
    [/madan önce$/iu, "maden önce"],
    [/meden önce$/iu, "madan önce"],
    [/dıktan sonra$/iu, "dikten sonra"],
    [/dikten sonra$/iu, "dıktan sonra"],
    [/duktan sonra$/iu, "dükten sonra"],
    [/dükten sonra$/iu, "duktan sonra"],
    [/tıktan sonra$/iu, "tikten sonra"],
    [/tikten sonra$/iu, "tıktan sonra"],
    [/arak$/iu, "erek"],
    [/erek$/iu, "arak"],
    [/yor$/iu, "yör"],
    [/iyor$/iu, "ıyor"],
    [/ıyor$/iu, "iyor"],
    [/dan$/iu, "den"],
    [/den$/iu, "dan"],
    [/da$/iu, "de"],
    [/de$/iu, "da"],
  ]
  for (const [pattern, replacement] of harmonySlips) {
    if (pattern.test(form)) {
      const next = form.replace(pattern, replacement)
      if (next && next !== form) return next
    }
  }

  // Swap common person endings
  const endingSwaps: Array<[RegExp, string]> = [
    [/im$/i, "iz"],
    [/iz$/i, "im"],
    [/sin$/i, "siniz"],
    [/siniz$/i, "sin"],
    [/um$/i, "uz"],
    [/üz$/i, "üm"],
    [/m$/i, "k"],
    [/k$/i, "m"],
    [/ler$/i, ""],
    [/lar$/i, ""],
  ]
  for (const [pattern, replacement] of endingSwaps) {
    if (pattern.test(form)) {
      const next = form.replace(pattern, replacement)
      if (next && next !== form) return next
    }
  }

  // Drop negation ma/me if present
  const withoutNeg = form.replace(/m([ae])(?=[a-zçğıöşü])/i, "")
  if (withoutNeg !== form && withoutNeg.length > 2) return withoutNeg

  // Last resort: flip final vowel harmony-ish letter
  if (form.endsWith("i")) return `${form.slice(0, -1)}ı`
  if (form.endsWith("ı")) return `${form.slice(0, -1)}i`
  return `${form}lar`
}

function normalizeAnswerKey(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR")
}

export function isQuestionPrompt(structure: { id: string; label: string; example?: string }, expected?: string) {
  if (expected?.trim().endsWith("?")) return true
  if (structure.id.includes("question")) return true
  if (structure.label.toLowerCase().includes("question")) return true
  if (structure.example?.trim().endsWith("?")) return true
  return false
}

function capitalizeLabel(label: string) {
  if (!label) return label
  return label.charAt(0).toLocaleUpperCase("tr-TR") + label.slice(1)
}

function blankCue(personTr: string, hint: string, structure: GrammarStructure) {
  // Keep `?` after the lemma so stripBlankLemma can remove `(hint)` cleanly when
  // BlankPrompt also receives lemma=… → one `(yapmak)`, then optional `?`.
  const mark = isQuestionPrompt(structure) ? "?" : ""
  return `${capitalizeLabel(personTr)} ______ (${hint})${mark}`
}

function isNounLikeStructure(structure: GrammarStructure) {
  return (
    structure.category === "case" ||
    structure.category === "noun" ||
    ["plural", "locative", "dative", "ablative", "accusative", "genitive", "possessive-suffixes"].includes(
      structure.id,
    )
  )
}

function usesPersonParadigm(structure: GrammarStructure) {
  if (!isNounLikeStructure(structure)) return true
  return structure.id === "possessive-suffixes" || structure.id === "verbal-nouns-possessive"
}

export function buildConjugationDrills(options: {
  structureIds: string[]
  verbTurkish?: string
  count?: number
  kind?: "translate" | "blank" | "sentence"
  /** When true (diagnostic/assessment), attach English gloss of intended meaning. */
  withEnglishGloss?: boolean
}): ConjugationPrompt[] {
  const count = options.count ?? 10
  const kind = options.kind === "sentence" ? "translate" : (options.kind ?? "translate")
  const withGloss = options.withEnglishGloss ?? options.kind === "sentence"
  const structures = options.structureIds
    .map((id) => getStructure(id))
    .filter((item): item is GrammarStructure => Boolean(item))
    .filter((item) => item.conjugable || item.category === "verb" || item.category === "noun" || item.category === "case")
  const usable = structures.length
    ? structures
    : (["present-continuous", "simple-past", "future"]
        .map((id) => getStructure(id))
        .filter(Boolean) as GrammarStructure[])

  const nounMode = usable.every(isNounLikeStructure)
  const fixedVerb = options.verbTurkish
    ? GRAMMAR_DRILL_VERBS.find((item) => item.turkish === options.verbTurkish)
    : null
  const wordPool: { turkish: string; english: string; stem: string }[] = nounMode
    ? GRAMMAR_DRILL_NOUNS.map((item) => ({ turkish: item.turkish, english: item.english, stem: item.turkish }))
    : fixedVerb
      ? [{ turkish: fixedVerb.turkish, english: fixedVerb.english, stem: fixedVerb.stem }]
      : GRAMMAR_DRILL_VERBS.map((item) => ({ turkish: item.turkish, english: item.english, stem: item.stem }))

  const prompts: ConjugationPrompt[] = []
  const seenAnswers = new Set<string>()
  const seenPrompts = new Set<string>()
  let personIndex = Math.floor(Math.random() * PERSONS.length)
  let structureIndex = Math.floor(Math.random() * usable.length)
  let wordIndex = Math.floor(Math.random() * wordPool.length)
  let guard = 0

  while (prompts.length < count && guard < count * 40) {
    guard += 1
    const structure = usable[structureIndex % usable.length]!
    structureIndex += 1
    const word = wordPool[wordIndex % wordPool.length]!
    wordIndex += 1
    const withPerson = usesPersonParadigm(structure)
    const person = withPerson ? PERSONS[personIndex % PERSONS.length]! : "3sg"
    if (withPerson) personIndex += 1

    const isPossessive = structure.id === "possessive-suffixes" || structure.id === "possessive"
    const form = isPossessive ? possessivePhrase(word.stem, person) : conjugate(structure.id, word.stem, person)
    // Never fall back to the lemma when conjugation fails.
    if (!form?.trim()) continue

    const personTr = isPossessive ? GENITIVE_LABEL[person] : PERSON_LABEL[person]
    const formBare = form.replace(/\?$/, "")
    const suffixOnly = isPossessive ? possessiveSuffix(word.stem, person) : formBare
    let expected = formBare
    let accepted =
      form === formBare ? [form] : [form, formBare]
    let cue: string
    if (isPossessive) {
      if (kind === "blank") {
        // Benim ______ (ev) → evim (full phrase still accepted)
        cue = blankCue(personTr, word.turkish, structure)
        expected = suffixOnly
        accepted = [suffixOnly, formBare]
      } else {
        cue = `______ (${POSSESSIVE_EN[person]} ${word.english})`
        expected = formBare
        accepted = [formBare, suffixOnly]
      }
    } else if (withPerson) {
      const hint = kind === "blank" ? word.turkish : word.english
      cue = blankCue(personTr, hint, structure)
    } else {
      const hint = kind === "blank" ? word.turkish : word.english
      const caseLabel = CASE_LABEL[structure.id]
      cue = caseLabel
        ? blankCue(caseLabel, hint, structure)
        : `______ (${hint})${isQuestionPrompt(structure) ? "?" : ""}`
    }

    // Conjugable tense/mood must never quiz the bare infinitive / stem.
    if (isBareLemmaExpected(structure.id, expected, word.turkish)) continue

    const answerKey = normalizeAnswerKey(expected)
    const promptKey = `${structure.id}|${word.turkish}|${person}`
    if (seenAnswers.has(answerKey) || seenPrompts.has(promptKey)) continue
    seenAnswers.add(answerKey)
    seenPrompts.add(promptKey)

    const gloss = englishGlossForForm({
      structureId: structure.id,
      verbEnglish: word.english,
      person,
      nounEnglish: isNounLikeStructure(structure) ? word.english : undefined,
    })
    const uncertainKey = /form unclear/i.test(gloss)
    const outKind: DrillKind =
      options.kind === "sentence" ? "sentence" : kind === "blank" ? "blank" : "translate"

    prompts.push({
      structureId: structure.id,
      structureLabel: structure.label,
      verb: word.turkish,
      verbEnglish: word.english,
      person,
      personLabel: withPerson ? personTr : word.turkish,
      promptEnglish: withGloss || outKind === "translate" || outKind === "sentence" ? gloss : cue,
      englishPrompt: gloss,
      expected,
      accepted,
      sentenceCue: cue,
      kind: outKind,
      turkishPrompt: cue,
      uncertainKey: uncertainKey || undefined,
    })
  }

  return prompts
}

export function buildContextDrills(structureIds: string[], count = 10) {
  return buildConjugationDrills({ structureIds, count, kind: "blank" }).map((item) => ({
    structureId: item.structureId,
    structureLabel: item.structureLabel,
    turkishPrompt: item.turkishPrompt ?? item.sentenceCue,
    sentenceCue: item.sentenceCue,
    blank: "______",
    expected: item.expected,
    accepted: item.accepted,
    verb: item.verb,
    verbEnglish: item.verbEnglish,
    englishPrompt: item.englishPrompt,
    kind: "blank" as const,
  }))
}

const PERSON_FROM_LABEL: Record<string, Person> = {
  ben: "1sg",
  sen: "2sg",
  o: "3sg",
  biz: "1pl",
  siz: "2pl",
  onlar: "3pl",
  "1sg": "1sg",
  "2sg": "2sg",
  "3sg": "3sg",
  "1pl": "1pl",
  "2pl": "2pl",
  "3pl": "3pl",
}

/**
 * Curated (non-productive) voice / lexical drills from structure.examples.
 * Skips browse-only "example" sentences; requires person-labeled forms.
 */
export function buildCuratedExampleDrills(
  structureId: string,
  count: number,
): ConjugationPrompt[] {
  const structure = getStructure(structureId)
  if (!structure) return []

  const pool = exampleParadigmsForStructure(structureId).flatMap((example) =>
    example.forms
      .filter((form) => form.label.trim().toLowerCase() !== "example")
      .map((form) => {
        const labelKey = form.label.trim().toLocaleLowerCase("tr-TR")
        const person = PERSON_FROM_LABEL[labelKey] ?? "3sg"
        return {
          headword: example.headword,
          english: example.english,
          person,
          personLabel: PERSON_LABEL[person],
          turkish: form.turkish.trim(),
        }
      })
      .filter((row) => row.turkish),
  )

  const prompts: ConjugationPrompt[] = []
  const seen = new Set<string>()
  for (const row of [...pool].sort(() => Math.random() - 0.5)) {
    if (prompts.length >= count) break
    const expected = row.turkish.replace(/[?!]+$/, "")
    if (!expected || isBareLemmaExpected(structureId, expected, row.headword)) continue
    const key = normalizeAnswerKey(expected)
    if (seen.has(key)) continue
    seen.add(key)

    const gloss = englishGlossForForm({
      structureId,
      verbEnglish: row.english,
      person: row.person,
    })
    const uncertainKey = /form unclear/i.test(gloss)
    const cue = blankCue(row.personLabel, row.headword, structure)
    prompts.push({
      structureId,
      structureLabel: structure.label,
      verb: row.headword,
      verbEnglish: row.english,
      person: row.person,
      personLabel: row.personLabel,
      promptEnglish: gloss,
      englishPrompt: gloss,
      expected,
      accepted: expected === row.turkish ? [expected] : [row.turkish, expected],
      sentenceCue: cue,
      kind: "blank",
      turkishPrompt: cue,
      uncertainKey: uncertainKey || undefined,
    })
  }
  return prompts
}

/** Diagnostic/assessment blanks: person cue + English gloss of intended meaning. */
export function buildDiagnosticBlankItems(structureIds: string[], perStructure = 3): ConjugationPrompt[] {
  const items: ConjugationPrompt[] = []
  for (const structureId of structureIds) {
    const structure = getStructure(structureId)
    if (!structure) continue

    let batch: ConjugationPrompt[] = []
    if (structure.conjugable) {
      batch = buildConjugationDrills({
        structureIds: [structureId],
        count: perStructure,
        kind: "blank",
        withEnglishGloss: true,
      })
    }
    // Lexical voice / static paradigms when live conjugation is unavailable.
    if (batch.length < perStructure) {
      const curated = buildCuratedExampleDrills(structureId, perStructure - batch.length)
      batch = [...batch, ...curated]
    }
    // Still short → mark any remaining gap as uncertain placeholders are NOT added;
    // fewer items is safer than infinitive/lemma quizzes.
    items.push(...batch.slice(0, perStructure))
  }
  return items
}

/**
 * Personalized practice mix per structure (~10):
 * 3 blank + 3 sentence + 2 translate + 2 error-correction.
 */
export function buildPracticeMixForStructure(structureId: string, count = 10): ConjugationPrompt[] {
  const blankN = Math.min(3, count)
  const sentenceN = Math.min(3, Math.max(0, count - blankN))
  const translateN = Math.min(2, Math.max(0, count - blankN - sentenceN))
  const errorN = Math.max(0, count - blankN - sentenceN - translateN)

  const blanks = buildConjugationDrills({
    structureIds: [structureId],
    count: blankN,
    kind: "blank",
    withEnglishGloss: true,
  })
  const sentences = buildConjugationDrills({
    structureIds: [structureId],
    count: sentenceN,
    kind: "sentence",
    withEnglishGloss: true,
  }).map((item) => ({
    ...item,
    kind: "sentence" as const,
    turkishPrompt: item.englishPrompt ?? item.promptEnglish,
    sentenceCue: item.englishPrompt ?? item.promptEnglish,
    promptEnglish: item.englishPrompt ?? item.promptEnglish,
  }))
  const translates = buildConjugationDrills({
    structureIds: [structureId],
    count: translateN,
    kind: "translate",
  }).map((item) => ({
    ...item,
    kind: "translate" as const,
    turkishPrompt: item.englishPrompt ?? item.promptEnglish,
    sentenceCue: item.englishPrompt ?? item.promptEnglish,
  }))

  const errorSeeds = buildConjugationDrills({
    structureIds: [structureId],
    count: Math.max(errorN * 2, errorN),
    kind: "blank",
    withEnglishGloss: true,
  })
  const errors: ConjugationPrompt[] = []
  const seenBroken = new Set<string>()
  for (const seed of errorSeeds) {
    if (errors.length >= errorN) break
    const broken = mutateWrongForm(seed.expected)
    if (!broken || broken === seed.expected || seenBroken.has(broken)) continue
    seenBroken.add(broken)
    errors.push({
      ...seed,
      kind: "error-correction",
      brokenForm: broken,
      turkishPrompt: `Düzelt: ${broken}`,
      sentenceCue: `Düzelt: ${broken}`,
      promptEnglish: `Correct: ${broken}`,
      englishPrompt: seed.englishPrompt,
    })
  }

  return [...blanks, ...sentences, ...translates, ...errors].sort(() => Math.random() - 0.5)
}

const DAILY_STRUCTURE_POOL = [
  "present-continuous",
  "present-continuous-negation",
  "simple-past",
  "simple-past-negation",
  "future",
  "future-negation",
  "aorist",
  "aorist-negation",
  "reported-past",
  "ability",
  "inability",
  "necessity",
  "basic-conditional",
  "imperative",
  "possessive-suffixes",
  "plural",
  "locative",
  "dative",
  "ablative",
  "accusative",
] as const

function matchesDailyLevel(structure: GrammarStructure, level?: CefrLevel | "mix") {
  if (!level || level === "mix") return structure.cefr === "A1" || structure.cefr === "A2"
  return structure.cefr === level
}

/** Daily test: 8 distinct topics × 4 blanks = 32 questions. */
export function buildDailyBlankTest(options?: {
  structureCount?: number
  questionsPerStructure?: number
  preferStructureIds?: string[]
  level?: CefrLevel | "mix"
}) {
  const structureCount = options?.structureCount ?? 8
  const perStructure = options?.questionsPerStructure ?? 4
  const prefer = options?.preferStructureIds ?? []
  const level = options?.level ?? "mix"

  const poolCatalog = DAILY_STRUCTURE_POOL.map((id) => getStructure(id)).filter(
    (item): item is GrammarStructure => Boolean(item) && matchesDailyLevel(item!, level),
  )
  // If a level has fewer than 8 pool topics, fill from that level’s conjugable catalog.
  const extras =
    poolCatalog.length < structureCount
      ? GRAMMAR_STRUCTURES.filter(
          (item) =>
            item.conjugable &&
            matchesDailyLevel(item, level) &&
            !poolCatalog.some((row) => row.id === item.id),
        )
      : []
  const catalog = [...poolCatalog, ...extras]
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const picked: GrammarStructure[] = []
  const used = new Set<string>()

  // Prefer weaker / focus topics when provided (already level-filtered by caller), then fill from catalog.
  for (const id of prefer) {
    if (picked.length >= structureCount) break
    const structure = byId.get(id)
    if (!structure || used.has(structure.id)) continue
    used.add(structure.id)
    picked.push(structure)
  }
  const rest = catalog.filter((item) => !used.has(item.id)).sort(() => Math.random() - 0.5)
  for (const structure of rest) {
    if (picked.length >= structureCount) break
    used.add(structure.id)
    picked.push(structure)
  }

  const items: ConjugationPrompt[] = []
  const seenAnswers = new Set<string>()
  const seenPrompts = new Set<string>()

  for (const structure of picked) {
    const nounMode = isNounLikeStructure(structure)
    const wordPool = nounMode
      ? GRAMMAR_DRILL_NOUNS.map((item) => ({ turkish: item.turkish, english: item.english, stem: item.turkish }))
      : GRAMMAR_DRILL_VERBS.map((item) => ({ turkish: item.turkish, english: item.english, stem: item.stem }))
    const withPerson = usesPersonParadigm(structure)
    const isPossessive = structure.id === "possessive-suffixes" || structure.id === "possessive"
    let made = 0
    let guard = 0
    let personIndex = Math.floor(Math.random() * PERSONS.length)
    let wordIndex = Math.floor(Math.random() * wordPool.length)

    while (made < perStructure && guard < perStructure * 40) {
      guard += 1
      const word = wordPool[wordIndex % wordPool.length]!
      wordIndex += 1
      const person = withPerson ? PERSONS[personIndex % PERSONS.length]! : "3sg"
      if (withPerson) personIndex += 1

      const form = isPossessive
        ? possessivePhrase(word.stem, person)
        : conjugate(structure.id, word.stem, person)
      if (!form?.trim()) continue

      const formBare = form.replace(/\?$/, "")
      const suffixOnly = isPossessive ? possessiveSuffix(word.stem, person) : formBare
      const expected = isPossessive ? suffixOnly : formBare
      if (isBareLemmaExpected(structure.id, expected, word.turkish)) continue
      const accepted = isPossessive
        ? [suffixOnly, formBare]
        : form === formBare
          ? [form]
          : [form, formBare]
      const answerKey = normalizeAnswerKey(expected)
      const promptKey = `${structure.id}|${word.turkish}|${person}`
      if (seenAnswers.has(answerKey) || seenPrompts.has(promptKey)) continue
      seenAnswers.add(answerKey)
      seenPrompts.add(promptKey)

      const personTr = isPossessive ? GENITIVE_LABEL[person] : PERSON_LABEL[person]
      const caseLabel = CASE_LABEL[structure.id]
      const cue = withPerson
        ? blankCue(personTr, word.turkish, structure)
        : caseLabel
          ? blankCue(caseLabel, word.turkish, structure)
          : `______ (${word.turkish})${isQuestionPrompt(structure) ? "?" : ""}`

      const gloss = englishGlossForForm({
        structureId: structure.id,
        verbEnglish: word.english,
        person,
        nounEnglish: nounMode ? word.english : undefined,
      })
      items.push({
        structureId: structure.id,
        structureLabel: structure.label,
        verb: word.turkish,
        verbEnglish: word.english,
        person,
        personLabel: withPerson ? personTr : word.turkish,
        promptEnglish: gloss,
        englishPrompt: gloss,
        expected,
        accepted,
        sentenceCue: cue,
        kind: "blank",
        turkishPrompt: cue,
        uncertainKey: /form unclear/i.test(gloss) || undefined,
      })
      made += 1
    }
  }

  return items.sort(() => Math.random() - 0.5)
}
