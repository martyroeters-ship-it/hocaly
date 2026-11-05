import { containsWord, normalizeTurkish } from "@/lib/turkish"
import type { CefrLevel } from "@/lib/types"

export type NarrativeWord = {
  turkish: string
  english: string
  partOfSpeech?: string | null
}

export type NarrativeSentence = {
  turkish: string
  english: string
  targetWords?: string[]
}

const PLACES = new Set([
  "okul",
  "park",
  "kafe",
  "cafe",
  "ev",
  "iş",
  "cami",
  "vapur",
  "sokak",
  "yol",
  "pazar",
  "köprü",
  "üniversite",
  "restoran",
  "market",
  "iskele",
  "meydan",
])
const FOOD = new Set(["çay", "kahve", "simit", "su", "ekmek", "börek"])
const MOTION = new Set(["gitmek", "gelmek", "yürümek", "çıkmak", "durmak", "acele etmek", "koşmak"])
const LOOK = new Set(["bakmak", "görmek", "izlemek"])
const PEOPLE = new Set(["arkadaş", "aile", "çocuk", "insan", "öğretmen"])
const TIME = new Set(["bugün", "sabah", "şimdi", "erken"])
const SCENE_ADJ = new Set(["güzel", "sakin", "soğuk", "sıcak", "kalabalık", "yavaş", "sessiz", "serin", "güneşli"])
const OBJECTS = new Set(["kitap", "ampul", "lamba"])
const TENNIS = new Set(["tenis", "top", "raket", "kort", "maç", "oyun", "oyuncu", "servis"])
const WEATHER_NOUNS = new Set(["hava"])

type Role = "place" | "food" | "motion" | "look" | "people" | "time" | "weather" | "object" | "tennis"

function sense(english: string) {
  return english.split(";")[0].replace(/^to\s+/i, "").trim()
}

function isSimple(cefr?: CefrLevel) {
  return !cefr || cefr === "A1" || cefr === "A2"
}

function roleOf(word: NarrativeWord): Role | null {
  const t = normalizeTurkish(word.turkish)
  if (TIME.has(t) || word.partOfSpeech === "adverb" && TIME.has(t)) return "time"
  if (PLACES.has(t)) return "place"
  if (FOOD.has(t)) return "food"
  if (MOTION.has(t)) return "motion"
  if (LOOK.has(t)) return "look"
  if (PEOPLE.has(t)) return "people"
  if (SCENE_ADJ.has(t) || WEATHER_NOUNS.has(t)) return "weather"
  if (TENNIS.has(t)) return "tennis"
  if (OBJECTS.has(t)) return "object"
  return null
}

export function sceneOf(topic: string): "tennis" | "istanbul-morning" | "park" | "cafe" | "home" | "school" | "generic" {
  const t = topic.toLowerCase()
  if (/tenis|tennis|kort/.test(t)) return "tennis"
  if (/istanbul|sabah|morning/.test(t)) return "istanbul-morning"
  if (/park/.test(t)) return "park"
  if (/cafe|kahve|coffee|çay/.test(t)) return "cafe"
  if (/\bhome\b|\bev\b|house/.test(t)) return "home"
  if (/okul|school|class/.test(t)) return "school"
  return "generic"
}

function seasoningScore(word: NarrativeWord, topic: string) {
  const t = normalizeTurkish(word.turkish)
  const topicFold = topic.toLowerCase()
  let score = 0
  if (topicFold.includes(t) || topicFold.includes(sense(word.english).toLowerCase())) score += 5
  if (t === "istanbul" && /istanbul/i.test(topic)) score += 5
  const role = roleOf(word)
  if (!role) return score
  const scene = sceneOf(topic)
  if (role === "place") score += scene === "home" && t !== "ev" && t !== "kafe" ? 1 : 3
  if (role === "food") score += scene === "home" ? 2 : 3
  if (role === "motion") score += scene === "tennis" && /koşmak|gelmek/.test(t) ? 3 : 2
  if (role === "look") score += 2
  if (role === "weather") score += 2
  if (role === "people") score += scene === "tennis" ? 3 : 1
  if (role === "time") score += 1
  if (role === "tennis") score += scene === "tennis" ? 4 : 0
  if (role === "object") score += scene === "istanbul-morning" || scene === "park" || scene === "cafe" || scene === "home" ? 2 : 0
  return score
}

export function pickSeasoning(words: NarrativeWord[], topic: string, max = 3) {
  return words
    .map((word) => ({ word, score: seasoningScore(word, topic) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((item) => item.word)
}

function take(words: NarrativeWord[], role: Role) {
  const index = words.findIndex((word) => roleOf(word) === role)
  if (index < 0) return undefined
  return words.splice(index, 1)[0]
}

function takeNamed(words: NarrativeWord[], turkish: string) {
  const index = words.findIndex((word) => normalizeTurkish(word.turkish) === turkish)
  if (index < 0) return undefined
  return words.splice(index, 1)[0]
}

function pickIndex(seed: number, length: number) {
  if (length <= 0) return 0
  return Math.abs(seed) % length
}

function pickOne<T>(items: T[], seed: number): T {
  return items[pickIndex(seed, items.length)]!
}

function withWord(word: NarrativeWord | undefined, turkish: string, english: string): NarrativeSentence {
  return word ? { turkish, english, targetWords: [word.turkish] } : { turkish, english }
}

function istanbulMorning(picked: NarrativeWord[], cefr?: CefrLevel): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const place = take(pool, "place")
  const food = take(pool, "food")
  const weather = take(pool, "weather")
  const motion = take(pool, "motion")
  const look = take(pool, "look")
  const object = take(pool, "object")
  const walk = motion && /yürümek|gitmek/.test(normalizeTurkish(motion.turkish)) ? motion : undefined
  const hurry = motion && normalizeTurkish(motion.turkish) === "acele etmek" ? motion : undefined

  const sentences: NarrativeSentence[] = [
    withWord(
      walk,
      simple ? "Bu sabah İstanbul'da yürüyorum." : "Bu sabah erken kalkıp İstanbul sokaklarında yürümeye başlıyorum.",
      simple
        ? "This morning I am walking in Istanbul."
        : "This morning I get up early and start walking through the streets of Istanbul.",
    ),
    weather
      ? withWord(weather, `Sokak bugün ${weather.turkish}.`, `The street is ${sense(weather.english)} today.`)
      : {
          turkish: simple ? "Hava güzel, sokak henüz sakin." : "Hava serin ve sokaklar henüz sakin.",
          english: simple ? "The weather is nice, and the street is still quiet." : "The air is cool and the streets are still quiet.",
        },
  ]

  if (food && /çay|kahve/.test(normalizeTurkish(food.turkish))) {
    sentences.push(
      withWord(
        food,
        `Küçük bir dükkândan ${food.turkish} alıp içiyorum.`,
        `I buy ${sense(food.english)} from a small shop and drink it.`,
      ),
    )
  } else if (food && normalizeTurkish(food.turkish) === "su") {
    sentences.push(withWord(food, "Küçük bir dükkândan su alıyorum.", "I buy water from a small shop."))
    sentences.push({ turkish: "Yanında bir simit yiyorum.", english: "I eat a simit with it." })
  } else if (food) {
    sentences.push(
      withWord(food, `Fırından sıcak bir ${food.turkish} alıyorum.`, `I buy a warm ${sense(food.english)} from the bakery.`),
    )
    sentences.push({ turkish: "Yanında bir çay içiyorum.", english: "I drink a tea with it." })
  } else {
    sentences.push({ turkish: "Fırından sıcak bir simit alıyorum.", english: "I buy a warm simit from the bakery." })
    sentences.push({ turkish: "Yanında bir çay içiyorum.", english: "I drink a tea with it." })
  }

  if (place) {
    const name = sense(place.english)
    sentences.push(
      withWord(
        place,
        simple
          ? `Karşıda bir ${place.turkish} var. Yanından geçiyorum.`
          : `Karşıda bir ${place.turkish} görünüyor; yanından geçip yürümeye devam ediyorum.`,
        simple
          ? `There is a ${name} across from me. I walk past it.`
          : `A ${name} comes into view across from me; I walk past it and keep going.`,
      ),
    )
  } else {
    sentences.push({
      turkish: simple ? "Karşıda bir cami var, biraz ileride de vapur iskelesi." : "Karşıda bir cami duruyor, biraz ileride vapur iskelesi görünüyor.",
      english: simple
        ? "There is a mosque across from me, and a little further on a ferry pier."
        : "A mosque stands across from me, and a little further on a ferry pier comes into view.",
    })
  }

  if (object) {
    sentences.push(withWord(object, "Bir bankta oturup kitap okuyorum.", "I sit on a bench and read a book."))
  } else if (look) {
    const t = normalizeTurkish(look.turkish)
    if (t === "izlemek") {
      sentences.push(withWord(look, "Biraz durup sokağı izliyorum.", "I pause and watch the street."))
    } else if (t === "görmek") {
      sentences.push(withWord(look, "Biraz durup sokağı görüyorum.", "I pause and look at the street."))
    } else {
      sentences.push(withWord(look, "Biraz durup sokağa bakıyorum.", "I pause and look at the street."))
    }
  } else if (hurry) {
    sentences.push(withWord(hurry, "Acele etmiyorum; yavaş yürüyorum.", "I am not in a hurry; I walk slowly."))
  }

  sentences.push({
    turkish: simple ? "Sonra yola devam ediyorum." : "Bir süre bakıp sonra yola devam ediyorum.",
    english: simple ? "Then I continue on my way." : "I look for a while, then continue on my way.",
  })
  return sentences.slice(0, cefr === "A1" ? 6 : 8)
}

function tennisScene(picked: NarrativeWord[], cefr?: CefrLevel, seed = 0): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const people = take(pool, "people")
  const weather = take(pool, "weather")
  const ball = takeNamed(pool, "top") ?? take(pool, "tennis")
  const run = takeNamed(pool, "koşmak")
  const come = takeNamed(pool, "gelmek")

  const openings: NarrativeSentence[] = people
    ? [
        withWord(people, "Arkadaşımla tenis kortundayız.", "My friend and I are on the tennis court."),
        withWord(people, "Bugün arkadaşımla tenis oynuyoruz.", "Today I am playing tennis with my friend."),
      ]
    : [
        { turkish: "Tenis kortundayız.", english: "We are on the tennis court." },
        { turkish: "Bugün tenis oynuyoruz.", english: "Today we are playing tennis." },
      ]

  const weatherLine = weather
    ? withWord(
        weather,
        normalizeTurkish(weather.turkish) === "hava"
          ? "Hava açık, kort güneşli."
          : `Hava ${weather.turkish}, kort güneşli.`,
        normalizeTurkish(weather.turkish) === "hava"
          ? "The sky is clear, and the court is sunny."
          : `The weather is ${sense(weather.english)}, and the court is sunny.`,
      )
    : { turkish: "Kort bugün güneşli.", english: "The court is sunny today." }

  const serve = people
    ? withWord(people, "Oyun başlıyor ve arkadaşım servis atıyor.", "The game starts and my friend serves.")
    : { turkish: "Oyun başlıyor ve karşı taraf servis atıyor.", english: "The game starts and the other side serves." }

  const incoming = withWord(
    ball ?? come,
    "Top bana geliyor.",
    "The ball is coming toward me.",
  )
  const reaction = withWord(
    run,
    simple ? "Koşup raketi uzatıyorum." : "Koşup raketi uzatıyor ve topu bekliyorum.",
    simple ? "I run and stretch out the racket." : "I run, stretch out the racket, and wait for the ball.",
  )
  const follow = {
    turkish: simple ? "Topu geri gönderiyorum ve oyun devam ediyor." : "Topu geri gönderiyorum; oyun böylece devam ediyor.",
    english: simple ? "I send the ball back and the game continues." : "I send the ball back; the game continues that way.",
  }

  const sentences = [pickOne(openings, seed), weatherLine, serve, incoming, reaction, follow]
  return sentences.slice(0, simple ? 6 : 8)
}

function parkScene(picked: NarrativeWord[], cefr?: CefrLevel): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const object = take(pool, "object")
  const people = take(pool, "people")
  const weather = take(pool, "weather")
  const motion = take(pool, "motion")
  const walk = motion && /yürümek|gitmek/.test(normalizeTurkish(motion.turkish)) ? motion : undefined
  const sentences: NarrativeSentence[] = [
    withWord(walk, simple ? "Bugün parka gidiyorum." : "Bugün yürüyerek parka gidiyorum.", simple ? "Today I am going to the park." : "Today I walk to the park."),
    weather
      ? withWord(weather, `Park bugün ${weather.turkish}.`, `The park is ${sense(weather.english)} today.`)
      : { turkish: "Ağaçların altında yürüyorum.", english: "I walk under the trees." },
  ]
  if (object) {
    sentences.push(withWord(object, "Bir bankta oturup kitap okuyorum.", "I sit on a bench and read a book."))
  } else {
    sentences.push({ turkish: "Bir bankta oturup dinleniyorum.", english: "I sit on a bench and rest." })
  }
  if (people) {
    sentences.push(
      withWord(
        people,
        `${normalizeTurkish(people.turkish) === "çocuk" ? "Çocuklar parkta oynuyor." : "Yanımda bir arkadaşım var."}`,
        normalizeTurkish(people.turkish) === "çocuk" ? "Children are playing in the park." : "A friend is with me.",
      ),
    )
  }
  sentences.push({ turkish: "Sonra yavaş yavaş eve dönüyorum.", english: "Then I slowly head home." })
  return sentences
}

function cafeScene(picked: NarrativeWord[], cefr?: CefrLevel): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const food = take(pool, "food")
  const people = take(pool, "people")
  const object = take(pool, "object")
  const drink = food ?? { turkish: "çay", english: "tea" }
  const sentences: NarrativeSentence[] = [
    { turkish: simple ? "Bugün bir kafeye gidiyorum." : "Bugün sakin bir kafeye uğruyorum.", english: simple ? "Today I am going to a cafe." : "Today I stop by a quiet cafe." },
    withWord(
      food,
      `İçeri girip ${drink.turkish} istiyorum.`,
      `I go in and order ${sense(drink.english)}.`,
    ),
  ]
  if (object) sentences.push(withWord(object, "Masada oturup kitap okuyorum.", "I sit at a table and read a book."))
  else sentences.push({ turkish: "Pencereden sokağı izliyorum.", english: "I watch the street from the window." })
  if (people) {
    sentences.push(withWord(people, "Bir arkadaşım da geliyor.", "A friend comes too."))
  }
  sentences.push({ turkish: "Sonra kalkıp yola devam ediyorum.", english: "Then I get up and continue on my way." })
  return sentences
}

function homeScene(picked: NarrativeWord[], cefr?: CefrLevel, seed = 0): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const place = take(pool, "place")
  const food = take(pool, "food")
  const object = take(pool, "object")
  const weather = take(pool, "weather")
  const home = place && /ev/.test(normalizeTurkish(place.turkish)) ? place : undefined
  const lamp = object && /ampul|lamba/.test(normalizeTurkish(object.turkish)) ? object : undefined
  const openings: NarrativeSentence[] = [
    withWord(home, simple ? "Sabah evdeyim." : "Bu sabah evde sakin bir şekilde uyanıyorum.", simple ? "I am at home this morning." : "This morning I wake up quietly at home."),
    withWord(home, simple ? "Bugün evdeyim." : "Bugün evde sakin bir sabah geçiriyorum.", simple ? "I am at home today." : "Today I spend a quiet morning at home."),
  ]
  const sentences: NarrativeSentence[] = [
    pickOne(openings, seed),
    food
      ? withWord(food, `${food.turkish} içip kahvaltı yapıyorum.`, `I drink ${sense(food.english)} and have breakfast.`)
      : { turkish: "Kahvaltı yapıyorum.", english: "I have breakfast." },
  ]
  if (weather) {
    sentences.push(
      withWord(
        weather,
        normalizeTurkish(weather.turkish) === "hava"
          ? "Pencereden bakınca hava sakin."
          : `Pencereden bakınca hava ${weather.turkish}.`,
        normalizeTurkish(weather.turkish) === "hava"
          ? "When I look out the window, the weather is calm."
          : `When I look out the window, the weather is ${sense(weather.english)}.`,
      ),
    )
  } else {
    sentences.push({ turkish: "Pencereden sokağı görüyorum.", english: "I look at the street from the window." })
  }
  if (lamp) {
    sentences.push(withWord(lamp, "Masada yeni bir ampul duruyor.", "A new light bulb sits on the table."))
    sentences.push({ turkish: "Ampulü takınca oda aydınlanıyor.", english: "When I put the bulb in, the room lights up." })
  } else if (object) {
    sentences.push(withWord(object, "Biraz kitap okuyorum.", "I read a book for a while."))
  }
  sentences.push({ turkish: "Sonra dışarı çıkıyorum.", english: "Then I go outside." })
  return sentences
}

function schoolScene(picked: NarrativeWord[], cefr?: CefrLevel): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const place = take(pool, "place")
  const people = take(pool, "people")
  const object = take(pool, "object")
  const school = place && /okul|üniversite/.test(normalizeTurkish(place.turkish)) ? place : undefined
  const sentences: NarrativeSentence[] = [
    withWord(school, simple ? "Bugün okula gidiyorum." : "Bu sabah okula yürüyerek gidiyorum.", simple ? "Today I am going to school." : "This morning I walk to school."),
    { turkish: "Sınıf henüz sakin.", english: "The classroom is still quiet." },
  ]
  if (people) {
    sentences.push(withWord(people, "Öğretmen merhaba diyor.", "The teacher says hello."))
  }
  if (object) sentences.push(withWord(object, "Kitabımı açıyorum.", "I open my book."))
  else sentences.push({ turkish: "Ders başlıyor.", english: "The lesson starts." })
  sentences.push({ turkish: "Sonra teneffüste dışarı çıkıyorum.", english: "Then I go outside at break." })
  return sentences
}

function genericScene(picked: NarrativeWord[], topic: string, cefr?: CefrLevel): NarrativeSentence[] {
  const simple = isSimple(cefr)
  const pool = [...picked]
  const place = take(pool, "place")
  const food = take(pool, "food")
  const motion = take(pool, "motion")
  const walk = motion && /yürümek|gitmek|çıkmak/.test(normalizeTurkish(motion.turkish)) ? motion : undefined
  const sentences: NarrativeSentence[] = [
    withWord(
      walk,
      simple ? "Bugün dışarı çıkıyorum." : `Bugün ${topic ? "şehirde" : "dışarıda"} kısa bir yürüyüşe çıkıyorum.`,
      simple ? "Today I go outside." : "Today I go out for a short walk in the city.",
    ),
  ]
  if (place) {
    sentences.push(withWord(place, `${place.turkish} tarafına yürüyorum.`, `I walk toward the ${sense(place.english)}.`))
  } else {
    sentences.push({ turkish: "Sokakta yürüyorum.", english: "I walk on the street." })
  }
  if (food) {
    sentences.push(withWord(food, `Bir ${food.turkish} alıyorum.`, `I buy ${sense(food.english)}.`))
  } else {
    sentences.push({ turkish: "Küçük bir dükkândan çay alıyorum.", english: "I buy tea from a small shop." })
  }
  sentences.push({ turkish: "İnsanları görüp biraz dinleniyorum.", english: "I see people and rest for a bit." })
  sentences.push({ turkish: "Sonra eve dönüyorum.", english: "Then I go home." })
  return sentences
}

function markUsed(sentences: NarrativeSentence[], words: NarrativeWord[]) {
  const used = new Set<string>()
  const text = sentences.map((sentence) => sentence.turkish).join(" ")
  for (const sentence of sentences) {
    for (const item of sentence.targetWords ?? []) used.add(item)
  }
  for (const word of words) {
    if (containsWord(text, word.turkish)) used.add(word.turkish)
  }
  return [...used]
}

export function composeTopicNarrative(options: {
  words: NarrativeWord[]
  topic: string
  cefr?: CefrLevel
  maxTargetWords?: number
  seed?: number
}) {
  const topic = options.topic.trim() || "Daily life"
  const picked = pickSeasoning(options.words, topic, options.maxTargetWords ?? 3)
  const scene = sceneOf(topic)
  const seed = options.seed ?? 0
  const sentences =
    scene === "tennis"
      ? tennisScene(picked, options.cefr, seed)
      : scene === "istanbul-morning"
        ? istanbulMorning(picked, options.cefr)
        : scene === "park"
          ? parkScene(picked, options.cefr)
          : scene === "cafe"
            ? cafeScene(picked, options.cefr)
            : scene === "home"
              ? homeScene(picked, options.cefr, seed)
              : scene === "school"
                ? schoolScene(picked, options.cefr)
                : genericScene(picked, topic, options.cefr)
  const usedWords = markUsed(sentences, options.words)
  return {
    title: topic,
    sentences,
    usedWords,
    omittedWords: options.words.map((word) => word.turkish).filter((item) => !usedWords.includes(item)),
  }
}
