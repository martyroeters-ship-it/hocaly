const DIACRITIC_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
}

export function turkishLower(input: string): string {
  return input.replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR")
}

export function normalizeTurkish(input: string): string {
  return turkishLower(input)
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
}

export function foldDiacritics(input: string): string {
  return normalizeTurkish(input)
    .split("")
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join("")
}

export function stripPunctuation(input: string): string {
  return input.replace(/[^\p{L}\p{N}\s'-]/gu, "").replace(/\s+/g, " ").trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const prev = new Array<number>(cols)
  const curr = new Array<number>(cols)

  for (let j = 0; j < cols; j += 1) prev[j] = j

  for (let i = 1; i < rows; i += 1) {
    curr[0] = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j < cols; j += 1) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j < cols; j += 1) prev[j] = curr[j]
  }

  return prev[b.length]
}

export function looksLikeVerb(word: string): boolean {
  const n = normalizeTurkish(word)
  return n.endsWith("mek") || n.endsWith("mak")
}

export function dictionaryFormGuess(word: string): string {
  const trimmed = word.trim()
  return looksLikeVerb(trimmed) ? trimmed : trimmed
}

const FRONT = /[eiöü]/
const BACK = /[aıou]/
const ROUNDED_FRONT = /[öü]/
const ROUNDED_BACK = /[ou]/

function lastVowel(stem: string): string | null {
  const chars = [...turkishLower(stem)]
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if ("aeıioöuü".includes(chars[i])) return chars[i]
  }
  return null
}

function harmony4(vowel: string): "ı" | "i" | "u" | "ü" {
  if (ROUNDED_FRONT.test(vowel)) return "ü"
  if (ROUNDED_BACK.test(vowel)) return "u"
  if (FRONT.test(vowel)) return "i"
  return "ı"
}

function harmony2(vowel: string): "a" | "e" {
  return FRONT.test(vowel) || vowel === "i" || vowel === "ö" || vowel === "ü" ? "e" : "a"
}

function verbStem(infinitive: string): string | null {
  const n = normalizeTurkish(infinitive)
  if (n.endsWith("mek") || n.endsWith("mak")) return n.slice(0, -3)
  return null
}

function bufferY(stem: string, suffix: string): string {
  const last = stem.at(-1) ?? ""
  if ("aeıioöuü".includes(last) && "aeıioöuü".includes(suffix[0] ?? "")) {
    return `${stem}y${suffix}`
  }
  return `${stem}${suffix}`
}

export type WordFormPreview = {
  form: string
  label: string
}

export function heuristicVerbForms(infinitive: string): WordFormPreview[] {
  const stem = verbStem(infinitive)
  if (!stem) return []
  const v = lastVowel(stem) ?? "a"
  const i = harmony4(v)
  const a = harmony2(v)
  const neg = stem.endsWith("a") || stem.endsWith("e") ? `${stem}m` : `${stem}m`
  const present = `${stem}${i}yor`
  const past = bufferY(stem, `d${i}`)
  const future = bufferY(stem, `${a}c${a}k`)
  const aorist = bufferY(stem, `${a}r`)
  const ability = bufferY(stem, `${a}bil${i}r`)
  const negAbility = `${neg}${a}m`
  const negative = `${neg}${i}yor`

  return [
    { form: present, label: "Present continuous (ben)" },
    { form: past, label: "Simple past (ben)" },
    { form: future, label: "Future (ben)" },
    { form: aorist, label: "Aorist (ben)" },
    { form: ability, label: "Ability" },
    { form: negAbility, label: "Negative ability" },
    { form: negative, label: "Negative present continuous" },
  ]
}

export function heuristicNounForms(word: string): WordFormPreview[] {
  if (!normalizeTurkish(word) || word.includes(" ")) return []
  return [
    { form: nounCase(word, "accusative"), label: "Accusative" },
    { form: nounCase(word, "dative"), label: "Dative" },
    { form: nounCase(word, "locative"), label: "Locative" },
    { form: nounCase(word, "ablative"), label: "Ablative" },
    { form: nounCase(word, "possessive1sg"), label: "1sg possessive" },
  ]
}

function isCapitalized(word: string) {
  const first = [...word.trim()][0] ?? ""
  return Boolean(first) && first !== turkishLower(first)
}

function mutateStem(word: string) {
  const last = normalizeTurkish(word).at(-1) ?? ""
  const voiced: Record<string, string> = { p: "b", ç: "c", t: "d", k: "ğ" }
  const next = voiced[last]
  if (!next) return word
  return `${word.slice(0, -1)}${next}`
}

export type NounCase = "accusative" | "dative" | "locative" | "ablative" | "possessive1sg"

export function nounCase(word: string, kind: NounCase): string {
  const original = word.trim()
  if (!original) return original
  const n = normalizeTurkish(original)
  const v = lastVowel(n) ?? "a"
  const i = harmony4(v)
  const a = harmony2(v)
  const last = n.at(-1) ?? ""
  const vowelEnd = "aeıioöuü".includes(last)
  const proper = isCapitalized(original)
  const sep = proper ? "'" : ""
  const voiceless = "pçtkfşh".includes(last)

  if (kind === "locative") return `${original}${sep}${voiceless && !proper ? "t" : "d"}${a}`
  if (kind === "ablative") return `${original}${sep}${voiceless && !proper ? "t" : "d"}${a}n`
  if (kind === "possessive1sg") return `${original}${vowelEnd ? "" : i}m`

  const stem = proper || vowelEnd ? original : mutateStem(original)
  const stemLast = normalizeTurkish(stem).at(-1) ?? last
  const stemVowelEnd = "aeıioöuü".includes(stemLast)
  if (kind === "accusative") return `${stem}${sep}${stemVowelEnd ? "y" : ""}${i}`
  return `${stem}${sep}${stemVowelEnd ? "y" : ""}${a}`
}

const PRESENT_1SG: Record<string, string> = {
  gitmek: "gidiyorum",
  gelmek: "geliyorum",
  yemek: "yiyorum",
  demek: "diyorum",
  etmek: "ediyorum",
  okumak: "okuyorum",
  içmek: "içiyorum",
  oynamak: "oynuyorum",
  anlamak: "anlıyorum",
  sevmek: "seviyorum",
  görmek: "görüyorum",
  almak: "alıyorum",
  beğenmek: "beğeniyorum",
}

export function presentContinuous1sg(infinitive: string): string | null {
  const n = normalizeTurkish(infinitive)
  if (PRESENT_1SG[n]) return PRESENT_1SG[n]
  const stem = verbStem(infinitive)
  if (!stem) return null
  const last = stem.at(-1) ?? ""
  let base: string
  if (last === "a" || last === "e") {
    const dropped = stem.slice(0, -1)
    const vv = lastVowel(dropped) ?? lastVowel(stem) ?? "a"
    base = `${dropped}${harmony4(vv)}yor`
  } else if ("ıioöuü".includes(last)) {
    base = `${stem}yor`
  } else {
    base = `${stem}${harmony4(lastVowel(stem) ?? "a")}yor`
  }
  return `${base}um`
}

export function comitative1sg(word: string): string {
  const poss = nounCase(word, "possessive1sg")
  const v = lastVowel(normalizeTurkish(poss)) ?? "a"
  const last = normalizeTurkish(poss).at(-1) ?? ""
  const a = harmony2(v)
  return `${poss}${"aeıioöuü".includes(last) ? "y" : ""}l${a}`
}

export function containsWord(haystack: string, word: string): boolean {
  const text = foldDiacritics(haystack)
  const target = foldDiacritics(word)
  if (!target) return false
  if (text.includes(target)) return true
  const stem = verbStem(word)
  if (stem && stem.length >= 3 && text.includes(foldDiacritics(stem))) return true
  return false
}
