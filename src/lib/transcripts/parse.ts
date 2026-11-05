import { foldDiacritics, normalizeTurkish } from "@/lib/turkish"

/** Function / glue words we never quiz. */
const STOP = new Set(
  [
    "bir",
    "bu",
    "şu",
    "o",
    "ve",
    "ile",
    "de",
    "da",
    "mi",
    "mı",
    "mu",
    "mü",
    "için",
    "ama",
    "çok",
    "daha",
    "en",
    "ki",
    "ne",
    "ya",
    "ben",
    "sen",
    "biz",
    "siz",
    "onlar",
    "var",
    "yok",
    "gibi",
    "kadar",
    "sonra",
    "önce",
    "şimdi",
    "belki",
    "değil",
    "olarak",
    "eğer",
    "çünkü",
    "ancak",
    "fakat",
    "hem",
    "bile",
    "hiç",
    "her",
    "kendi",
    "şey",
    "veya",
    "yahut",
    "ise",
    "diye",
    "üzere",
    "göre",
    "karşı",
    "doğru",
    "beri",
    "dek",
    "değin",
    "sanki",
    "acaba",
    "nasıl",
    "neden",
    "niçin",
    "nerede",
    "nereye",
    "nereden",
    "hangi",
    "kim",
    "kime",
    "kimi",
    "bunu",
    "bunun",
    "şunu",
    "şunun",
    "onu",
    "onun",
    "bizi",
    "sizi",
    "bana",
    "sana",
    "bize",
    "size",
    "benim",
    "senin",
    "bizim",
    "sizin",
    "onların",
  ].map(normalizeTurkish),
)

/**
 * High-frequency / beginner content that is quiz-eligible but scored lower
 * so we prefer richer vocabulary when the sentence has better options.
 */
const EASY = new Set(
  [
    "gün",
    "günler",
    "zaman",
    "evet",
    "hayır",
    "lütfen",
    "teşekkür",
    "merhaba",
    "günaydın",
    "iyi",
    "güzel",
    "büyük",
    "küçük",
    "yeni",
    "eski",
    "uzun",
    "kısa",
    "ev",
    "evde",
    "okul",
    "okulda",
    "iş",
    "işte",
    "su",
    "çay",
    "kahve",
    "yemek",
    "adam",
    "kadın",
    "çocuk",
    "insan",
    "arkadaş",
    "anne",
    "baba",
    "kardeş",
    "bugün",
    "dün",
    "yarın",
    "sabah",
    "akşam",
    "gece",
    "saat",
    "yıl",
    "ay",
    "hafta",
    "burada",
    "orada",
    "şurada",
    "gelmek",
    "gitmek",
    "yapmak",
    "olmak",
    "etmek",
    "demek",
    "almak",
    "vermek",
    "bakmak",
    "görmek",
    "bilmek",
    "istemek",
    "sevmek",
    "geldi",
    "gitti",
    "yaptı",
    "oldu",
    "dedi",
    "aldı",
    "verdi",
    "baktı",
    "gördü",
    "biliyorum",
    "istiyorum",
    "geliyor",
    "gidiyor",
    "yapıyor",
    "oluyor",
  ].map(normalizeTurkish),
)

const MAX_TARGETS_PER_SENTENCE = 3

export type ParsedTranscriptSentence = {
  index: number
  turkish: string
  targets: { turkish: string; start: number; end: number }[]
}

function splitSentences(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?…])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
}

function tokenSpans(sentence: string) {
  const spans: { turkish: string; start: number; end: number }[] = []
  const re = /[\p{L}]+(?:['’][\p{L}]+)?/gu
  let match: RegExpExecArray | null
  while ((match = re.exec(sentence))) {
    spans.push({ turkish: match[0], start: match.index, end: match.index + match[0].length })
  }
  return spans
}

/** Infinitives and common finite / participle endings. */
export function looksLikeVerbForm(word: string) {
  const n = normalizeTurkish(word)
  if (n.length < 4) return false
  if (/(mak|mek)$/.test(n)) return true
  // Progressive, past, evidential, future, necessity, ability, conditional
  if (
    /(yor(?:um|sun|uz|sunuz|lar)?|iyor(?:um|sun|uz|sunuz|lar)?|ıyor(?:um|sun|uz|sunuz|lar)?|uyor(?:um|sun|uz|sunuz|lar)?|üyor(?:um|sun|uz|sunuz|lar)?)$/.test(
      n,
    )
  ) {
    return true
  }
  if (/(dı[mk]?|di[mk]?|du[mk]?|dü[mk]?|tı[mk]?|ti[mk]?|tu[mk]?|tü[mk]?|dık|dik|duk|dük|tık|tik|tuk|tük)$/.test(n)) {
    return true
  }
  if (/(mış(?:ım|sın|ız|sınız|lar)?|miş(?:im|sin|iz|siniz|ler)?|muş(?:um|sun|uz|sunuz|lar)?|müş(?:üm|sün|üz|sünüz|ler)?)$/.test(n)) {
    return true
  }
  if (
    /(acağ(?:ım|ız)|eceğ(?:im|iz)|acak(?:sın|sınız|lar)?|ecek(?:sin|siniz|ler)?)$/.test(n)
  ) {
    return true
  }
  if (/(malı(?:yım|sın|yız|sınız|lar)?|meli(?:yim|sin|yiz|siniz|ler)?)$/.test(n)) return true
  if (/(abilir(?:im|sin|iz|siniz|ler)?|ebilir(?:im|sin|iz|siniz|ler)?|amaz|emez)$/.test(n)) return true
  if (/(ırken|erken|arak|erek|ınca|ince|unca|ünce)$/.test(n)) return true
  return false
}

export function contentWordScore(word: string) {
  const n = normalizeTurkish(word)
  const folded = foldDiacritics(n)
  if (!n || STOP.has(n) || STOP.has(folded)) return -100
  let score = Math.min(n.length, 14)
  if (looksLikeVerbForm(n)) score += 4
  if (n.length >= 7) score += 2
  if (n.length >= 9) score += 1
  if (n.length <= 4) score -= 2
  if (EASY.has(n) || EASY.has(folded)) score -= 5
  return score
}

function isQuizCandidate(token: string) {
  const n = normalizeTurkish(token)
  if (n.length < 4) return false
  if (STOP.has(n) || STOP.has(foldDiacritics(n))) return false
  return true
}

/** Pick up to 3 contentful targets: prefer a verb + stronger nouns over first tokens. */
function selectTargets(tokens: { turkish: string; start: number; end: number }[]) {
  const candidates = tokens
    .filter((token) => isQuizCandidate(token.turkish))
    .map((token) => ({
      ...token,
      key: normalizeTurkish(token.turkish),
      score: contentWordScore(token.turkish),
      verb: looksLikeVerbForm(token.turkish),
    }))

  // Unique within the sentence (keep highest-scoring span for a form)
  const best = new Map<string, (typeof candidates)[number]>()
  for (const item of candidates) {
    const prev = best.get(item.key)
    if (!prev || item.score > prev.score) best.set(item.key, item)
  }
  const unique = [...best.values()].sort((a, b) => b.score - a.score || a.start - b.start)
  if (!unique.length) return []

  const picked: typeof unique = []
  const used = new Set<string>()

  const take = (item: (typeof unique)[number] | undefined) => {
    if (!item || used.has(item.key) || picked.length >= MAX_TARGETS_PER_SENTENCE) return
    used.add(item.key)
    picked.push(item)
  }

  // Prefer at least one verb when available
  take(unique.find((item) => item.verb))
  // Then strongest non-verbs
  for (const item of unique.filter((row) => !row.verb)) {
    take(item)
    if (picked.length >= MAX_TARGETS_PER_SENTENCE) break
  }
  // Fill with remaining (other verbs / leftovers)
  for (const item of unique) {
    take(item)
    if (picked.length >= MAX_TARGETS_PER_SENTENCE) break
  }

  // Stable left-to-right order for highlighting / storage
  return picked
    .sort((a, b) => a.start - b.start)
    .map(({ turkish, start, end }) => ({ turkish, start, end }))
}

export function parseTranscriptText(raw: string): ParsedTranscriptSentence[] {
  const sentences = splitSentences(raw)
  return sentences.map((turkish, index) => ({
    index,
    turkish,
    targets: selectTargets(tokenSpans(turkish)),
  }))
}

export function highlightSentence(sentence: string, start: number, end: number) {
  return {
    before: sentence.slice(0, start),
    target: sentence.slice(start, end),
    after: sentence.slice(end),
  }
}
