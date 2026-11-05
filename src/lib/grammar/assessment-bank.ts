/**
 * Curated assessment / diagnostic question bank.
 *
 * Questions are full Turkish sentences with a single blank whose English cue
 * unambiguously encodes tense, mood, voice, and polarity. No generic
 * "Ben ______ (verb)" + "person: verb" path for assessment/diagnostic.
 */
import { getStructure } from "@/lib/grammar"
import { stripInfinitive, type ConjugationPrompt, type Person } from "@/lib/grammar/conjugate"

/** Bump when bank quality changes — triggers one-shot assessment progress reset. */
export const ASSESSMENT_BANK_VERSION = 7

export type AssessmentTemplate = {
  structureId: string
  /** Full unambiguous English sentence. */
  english: string
  /** Complete correct Turkish sentence. */
  turkishFull: string
  /** Exact substring of turkishFull that the learner must type. */
  blank: string
  accepted?: string[]
  /** Optional lemma shown after the blank, e.g. (gelmek). */
  lemma?: string
}

export type ValidatedAssessmentItem = ConjugationPrompt & {
  turkishFull: string
}

const INFINITIVE_OK = new Set(["infinitives", "purpose-mak-icin", "verbal-nouns"])
/** Imperative 2sg is often the bare stem (gel, git) — that is the target form. */
const STEM_OK = new Set(["imperative", "basic-verb-negation", ...INFINITIVE_OK])

function t(
  structureId: string,
  english: string,
  turkishFull: string,
  blank: string,
  opts?: { accepted?: string[]; lemma?: string },
): AssessmentTemplate {
  return {
    structureId,
    english,
    turkishFull,
    blank,
    accepted: opts?.accepted,
    lemma: opts?.lemma,
  }
}

/** All curated templates (flat). */
export const ASSESSMENT_TEMPLATES: AssessmentTemplate[] = [
  // ── Nouns / cases ─────────────────────────────────────────────────────────
  t("plural", "I see the books.", "Kitapları görüyorum.", "Kitapları", { lemma: "kitap" }),
  t("plural", "The houses are big.", "Evler büyük.", "Evler", { lemma: "ev" }),
  t("plural", "The schools are closed today.", "Okullar bugün kapalı.", "Okullar", { lemma: "okul" }),
  t("plural", "The cars are outside.", "Arabalar dışarıda.", "Arabalar", { lemma: "araba" }),

  t("locative", "I am at home.", "Evdeyim.", "Evde", { lemma: "ev", accepted: ["evde"] }),
  t("locative", "The book is at school.", "Kitap okulda.", "okulda", { lemma: "okul" }),
  t("locative", "We are in the car.", "Arabadayız.", "Arabada", { lemma: "araba", accepted: ["arabada"] }),
  t("locative", "She is in Istanbul.", "İstanbul'da.", "İstanbul'da", { lemma: "İstanbul", accepted: ["Istanbul'da", "istanbulda"] }),

  t("dative", "I am going to school.", "Okula gidiyorum.", "Okula", { lemma: "okul" }),
  t("dative", "Give it to me — to the house.", "Eve geliyorum.", "Eve", { lemma: "ev" }),
  t("dative", "We are going to the car.", "Arabaya gidiyoruz.", "Arabaya", { lemma: "araba" }),
  t("dative", "She went to the door.", "Kapıya gitti.", "Kapıya", { lemma: "kapı" }),

  t("ablative", "I am coming from home.", "Evden geliyorum.", "Evden", { lemma: "ev" }),
  t("ablative", "He came from school.", "Okuldan geldi.", "Okuldan", { lemma: "okul" }),
  t("ablative", "We left from the car.", "Arabadan indik.", "Arabadan", { lemma: "araba" }),
  t("ablative", "She took it from the book.", "Kitaptan okudu.", "Kitaptan", { lemma: "kitap" }),

  t("accusative", "I am reading the book.", "Kitabı okuyorum.", "Kitabı", { lemma: "kitap" }),
  t("accusative", "I see the house.", "Evi görüyorum.", "Evi", { lemma: "ev" }),
  t("accusative", "She opened the door.", "Kapıyı açtı.", "Kapıyı", { lemma: "kapı" }),
  t("accusative", "We bought the car.", "Arabayı aldık.", "Arabayı", { lemma: "araba" }),

  t("genitive", "This is the book's cover.", "Bu kitabın kapağı.", "kitabın", { lemma: "kitap" }),
  t("genitive", "That is the house's door.", "O evin kapısı.", "evin", { lemma: "ev" }),
  t("genitive", "This is the school's garden.", "Bu okulun bahçesi.", "okulun", { lemma: "okul" }),

  t("possessive-suffixes", "This is my house.", "Bu benim evim.", "evim", { lemma: "ev" }),
  t("possessive-suffixes", "Where is your book?", "Senin kitabın nerede?", "kitabın", { lemma: "kitap" }),
  t("possessive-suffixes", "His/her car is new.", "Onun arabası yeni.", "arabası", { lemma: "araba" }),
  t("possessive-suffixes", "Our school is big.", "Bizim okulumuz büyük.", "okulumuz", { lemma: "okul" }),
  t("possessive-suffixes", "Their door is open.", "Onların kapısı açık.", "kapısı", { lemma: "kapı" }),

  // ── Present continuous (right-now context — not habitual aorist) ───────────
  t("present-continuous", "I am coming now.", "Şimdi geliyorum.", "geliyorum", { lemma: "gelmek" }),
  t("present-continuous", "You (sg) are reading a book right now.", "Sen şu anda kitap okuyorsun.", "okuyorsun", {
    lemma: "okumak",
  }),
  t("present-continuous", "She is going to school right now.", "O şu anda okula gidiyor.", "gidiyor", {
    lemma: "gitmek",
  }),
  t("present-continuous", "We are writing a letter right now.", "Biz şu anda mektup yazıyoruz.", "yazıyoruz", {
    lemma: "yazmak",
  }),
  t("present-continuous", "They are speaking Turkish right now.", "Onlar şu anda Türkçe konuşuyorlar.", "konuşuyorlar", {
    lemma: "konuşmak",
    accepted: ["konuşuyor"],
  }),

  t("present-continuous-negation", "I am not going right now.", "Şu anda gitmiyorum.", "gitmiyorum", {
    lemma: "gitmek",
  }),
  t("present-continuous-negation", "You (sg) are not coming right now.", "Sen şu anda gelmiyorsun.", "gelmiyorsun", {
    lemma: "gelmek",
  }),
  t("present-continuous-negation", "She is not reading right now.", "O şu anda okumuyor.", "okumuyor", {
    lemma: "okumak",
  }),
  t("present-continuous-negation", "We are not working now.", "Şimdi çalışmıyoruz.", "çalışmıyoruz", {
    lemma: "çalışmak",
  }),

  t("present-continuous-questions", "Are you (sg) coming right now?", "Şu anda geliyor musun?", "geliyor musun", {
    lemma: "gelmek",
    accepted: ["Geliyor musun?", "Geliyor musun", "geliyor musun"],
  }),
  t("present-continuous-questions", "Is she going right now?", "Şu anda gidiyor mu?", "gidiyor mu", {
    lemma: "gitmek",
    accepted: ["Gidiyor mu?", "Gidiyor mu"],
  }),
  t("present-continuous-questions", "Are they reading right now?", "Şu anda okuyorlar mı?", "okuyorlar mı", {
    lemma: "okumak",
    accepted: ["Okuyorlar mı?", "Okuyorlar mı"],
  }),
  t("present-continuous-questions", "Are we writing right now?", "Şu anda yazıyor muyuz?", "yazıyor muyuz", {
    lemma: "yazmak",
    accepted: ["Yazıyor muyuz?", "Yazıyor muyuz"],
  }),

  // ── Simple past ───────────────────────────────────────────────────────────
  t("simple-past", "I came yesterday.", "Dün geldim.", "geldim", { lemma: "gelmek" }),
  t("simple-past", "You (sg) went home.", "Sen eve gittin.", "gittin", { lemma: "gitmek" }),
  t("simple-past", "She read the book.", "O kitabı okudu.", "okudu", { lemma: "okumak" }),
  t("simple-past", "We wrote a letter.", "Biz mektup yazdık.", "yazdık", { lemma: "yazmak" }),
  t("simple-past", "They did the work.", "Onlar işi yaptılar.", "yaptılar", { lemma: "yapmak", accepted: ["yaptı"] }),

  t("simple-past-negation", "I did not come.", "Gelmedim.", "Gelmedim", { lemma: "gelmek", accepted: ["gelmedim"] }),
  t("simple-past-negation", "You (sg) did not go.", "Sen gitmedin.", "gitmedin", { lemma: "gitmek" }),
  t("simple-past-negation", "She did not understand.", "O anlamadı.", "anlamadı", { lemma: "anlamak" }),
  t("simple-past-negation", "We did not write.", "Biz yazmadık.", "yazmadık", { lemma: "yazmak" }),

  t("simple-past-questions", "Did you (sg) come?", "Geldin mi?", "Geldin mi?", {
    lemma: "gelmek",
    accepted: ["geldin mi"],
  }),
  t("simple-past-questions", "Did she go?", "Gitti mi?", "Gitti mi?", { lemma: "gitmek", accepted: ["gitti mi"] }),
  t("simple-past-questions", "Did they read?", "Okudular mı?", "Okudular mı?", {
    lemma: "okumak",
    accepted: ["okudular mı", "okudu mu"],
  }),

  // ── Imperative / basic negation ───────────────────────────────────────────
  t("imperative", "Come!", "Gel!", "Gel", { lemma: "gelmek", accepted: ["gel"] }),
  t("imperative", "Go (plural/polite)!", "Gidin!", "Gidin", { lemma: "gitmek", accepted: ["gidin"] }),
  t("imperative", "Read (plural/polite)!", "Okuyun!", "Okuyun", { lemma: "okumak", accepted: ["okuyun"] }),
  t("imperative", "Understand (plural/polite)!", "Anlayın!", "Anlayın", { lemma: "anlamak", accepted: ["anlayın"] }),

  t("basic-verb-negation", "Don't come!", "Gelme!", "Gelme", { lemma: "gelmek", accepted: ["gelme"] }),
  t("basic-verb-negation", "Don't go!", "Gitme!", "Gitme", { lemma: "gitmek", accepted: ["gitme"] }),
  t("basic-verb-negation", "Don't do that!", "Yapma!", "Yapma", { lemma: "yapmak", accepted: ["yapma"] }),

  // ── Future ────────────────────────────────────────────────────────────────
  t("future", "I will come tomorrow.", "Yarın geleceğim.", "geleceğim", { lemma: "gelmek" }),
  t("future", "You (sg) will go.", "Sen gideceksin.", "gideceksin", { lemma: "gitmek" }),
  t("future", "She will read the book.", "O kitabı okuyacak.", "okuyacak", { lemma: "okumak" }),
  t("future", "We will write a letter.", "Biz mektup yazacağız.", "yazacağız", { lemma: "yazmak" }),
  t("future", "They will do it.", "Onlar yapacaklar.", "yapacaklar", { lemma: "yapmak", accepted: ["yapacak"] }),

  t("future-negation", "I will not come.", "Gelmeyeceğim.", "Gelmeyeceğim", {
    lemma: "gelmek",
    accepted: ["gelmeyeceğim"],
  }),
  t("future-negation", "You (sg) will not go.", "Sen gitmeyeceksin.", "gitmeyeceksin", { lemma: "gitmek" }),
  t("future-negation", "She will not write.", "O yazmayacak.", "yazmayacak", { lemma: "yazmak" }),
  t("future-negation", "We will not do that.", "Biz yapmayacağız.", "yapmayacağız", { lemma: "yapmak" }),

  t("future-questions", "Will you (sg) come?", "Gelecek misin?", "Gelecek misin?", {
    lemma: "gelmek",
    accepted: ["gelecek misin"],
  }),
  t("future-questions", "Will she go?", "Gidecek mi?", "Gidecek mi?", { lemma: "gitmek", accepted: ["gidecek mi"] }),
  t("future-questions", "Will they read?", "Okuyacaklar mı?", "Okuyacaklar mı?", {
    lemma: "okumak",
    accepted: ["okuyacaklar mı"],
  }),

  // ── Aorist (habit / general truth — not present continuous) ───────────────
  t("aorist", "I usually go to school.", "Genellikle okula giderim.", "giderim", { lemma: "gitmek" }),
  t("aorist", "You (sg) usually drink tea in the morning.", "Sen genellikle sabahları çay içersin.", "içersin", {
    lemma: "içmek",
  }),
  t("aorist", "She reads every day.", "O her gün okur.", "okur", { lemma: "okumak" }),
  t("aorist", "We usually write letters.", "Biz genellikle mektup yazarız.", "yazarız", { lemma: "yazmak" }),
  t("aorist", "They come here often.", "Onlar buraya sık sık gelirler.", "gelirler", {
    lemma: "gelmek",
    accepted: ["gelir"],
  }),

  t("aorist-negation", "I usually do not go there.", "Genellikle oraya gitmem.", "gitmem", { lemma: "gitmek" }),
  t("aorist-negation", "We usually do not come early.", "Genellikle erken gelmeyiz.", "gelmeyiz", {
    lemma: "gelmek",
  }),
  t("aorist-negation", "She usually does not drink coffee.", "O genellikle kahve içmez.", "içmez", {
    lemma: "içmek",
  }),
  t("aorist-negation", "They usually do not write.", "Onlar genellikle yazmazlar.", "yazmazlar", {
    lemma: "yazmak",
    accepted: ["yazmaz"],
  }),

  t("aorist-questions", "Do you (sg) usually go there?", "Genellikle oraya gider misin?", "gider misin", {
    lemma: "gitmek",
    accepted: ["Gider misin?", "Gider misin"],
  }),
  t("aorist-questions", "Does she usually read?", "Genellikle okur mu?", "okur mu", {
    lemma: "okumak",
    accepted: ["Okur mu?", "Okur mu"],
  }),
  t("aorist-questions", "Do they usually come?", "Genellikle gelirler mi?", "gelirler mi", {
    lemma: "gelmek",
    accepted: ["Gelirler mi?", "Gelirler mi"],
  }),

  // ── Reported past ─────────────────────────────────────────────────────────
  t("reported-past", "Apparently I came late.", "Geç gelmişim.", "gelmişim", { lemma: "gelmek" }),
  t("reported-past", "Apparently she went home.", "Eve gitmiş.", "gitmiş", { lemma: "gitmek" }),
  t("reported-past", "Apparently they read it.", "Onlar okumuşlar.", "okumuşlar", {
    lemma: "okumak",
    accepted: ["okumuş"],
  }),
  t("reported-past", "Apparently we did it.", "Biz yapmışız.", "yapmışız", { lemma: "yapmak" }),

  t("reported-past-negation", "Apparently I did not come.", "Gelmemişim.", "Gelmemişim", {
    lemma: "gelmek",
    accepted: ["gelmemişim"],
  }),
  t("reported-past-negation", "Apparently she did not go.", "Gitmemiş.", "Gitmemiş", {
    lemma: "gitmek",
    accepted: ["gitmemiş"],
  }),
  t("reported-past-negation", "Apparently they did not write.", "Yazmamışlar.", "Yazmamışlar", {
    lemma: "yazmak",
    accepted: ["yazmamış"],
  }),

  t("reported-past-questions", "Did she apparently come?", "Gelmiş mi?", "Gelmiş mi?", {
    lemma: "gelmek",
    accepted: ["gelmiş mi"],
  }),
  t("reported-past-questions", "Did they apparently go?", "Gitmişler mi?", "Gitmişler mi?", {
    lemma: "gitmek",
    accepted: ["gitmişler mi"],
  }),

  // ── Ability / necessity / obligation / suggestion / conditional ───────────
  t("ability", "I can go tomorrow.", "Yarın gidebilirim.", "gidebilirim", { lemma: "gitmek" }),
  t("ability", "You (sg) can read this.", "Sen bunu okuyabilirsin.", "okuyabilirsin", { lemma: "okumak" }),
  t("ability", "She can come today.", "O bugün gelebilir.", "gelebilir", { lemma: "gelmek" }),
  t("ability", "We can write it.", "Biz yazabiliriz.", "yazabiliriz", { lemma: "yazmak" }),
  t("ability", "I can understand Turkish.", "Türkçe anlayabilirim.", "anlayabilirim", { lemma: "anlamak" }),

  t("inability", "I cannot go today.", "Bugün gidemiyorum.", "gidemiyorum", { lemma: "gitmek" }),
  t("inability", "She cannot come.", "O gelemiyor.", "gelemiyor", { lemma: "gelmek" }),
  t("inability", "We cannot understand.", "Anlayamıyoruz.", "Anlayamıyoruz", {
    lemma: "anlamak",
    accepted: ["anlayamıyoruz"],
  }),
  t("inability", "They cannot write.", "Yazamıyorlar.", "Yazamıyorlar", {
    lemma: "yazmak",
    accepted: ["yazamıyorlar"],
  }),

  t("necessity", "I must come early.", "Erken gelmeliyim.", "gelmeliyim", { lemma: "gelmek" }),
  t("necessity", "You (sg) must go now.", "Şimdi gitmelisin.", "gitmelisin", { lemma: "gitmek" }),
  t("necessity", "She must read this.", "Bunu okumalı.", "okumalı", { lemma: "okumak" }),
  t("necessity", "We must write today.", "Bugün yazmalıyız.", "yazmalıyız", { lemma: "yazmak" }),
  t("necessity", "They must work.", "Çalışmalılar.", "Çalışmalılar", {
    lemma: "çalışmak",
    accepted: ["çalışmalı"],
  }),

  t("obligation-zorunda", "I have to go.", "Gitmek zorundayım.", "Gitmek zorundayım", {
    lemma: "gitmek",
    accepted: ["gitmek zorundayım"],
  }),
  t("obligation-zorunda", "She has to come.", "Gelmek zorunda.", "Gelmek zorunda", {
    lemma: "gelmek",
    accepted: ["gelmek zorunda"],
  }),
  t("obligation-zorunda", "We have to write.", "Yazmak zorundayız.", "Yazmak zorundayız", {
    lemma: "yazmak",
    accepted: ["yazmak zorundayız"],
  }),

  t("suggestion-lets", "Let's go!", "Gidelim!", "Gidelim", { lemma: "gitmek", accepted: ["gidelim"] }),
  t("suggestion-lets", "Let's read.", "Okuyalım.", "Okuyalım", { lemma: "okumak", accepted: ["okuyalım"] }),
  t("suggestion-lets", "Let's understand this.", "Bunu anlayalım.", "anlayalım", { lemma: "anlamak" }),
  t("suggestion-lets", "Let's come tomorrow.", "Yarın gelelim.", "gelelim", { lemma: "gelmek" }),

  t("basic-conditional", "If I come, I will call.", "Gelirsem ararım.", "Gelirsem", {
    lemma: "gelmek",
    accepted: ["gelirsem", "gelsem"],
  }),
  t("basic-conditional", "If you (sg) go, tell me.", "Gidersen söyle.", "Gidersen", {
    lemma: "gitmek",
    accepted: ["gidersen", "gitsen"],
  }),
  t("basic-conditional", "If she reads, she learns.", "Okursa öğrenir.", "Okursa", {
    lemma: "okumak",
    accepted: ["okursa"],
  }),
  t("basic-conditional", "If we write, they read.", "Yazarsak okurlar.", "Yazarsak", {
    lemma: "yazmak",
    accepted: ["yazarsak", "yazsak"],
  }),

  // ── Verb constructions ────────────────────────────────────────────────────
  t("infinitives", "I want to swim.", "Yüzmek istiyorum.", "Yüzmek", { lemma: "yüzmek", accepted: ["yüzmek"] }),
  t("infinitives", "She wants to read.", "Okumak istiyor.", "Okumak", { lemma: "okumak", accepted: ["okumak"] }),
  t("infinitives", "We want to go.", "Gitmek istiyoruz.", "Gitmek", { lemma: "gitmek", accepted: ["gitmek"] }),

  t("verbal-nouns", "I love swimming.", "Yüzmeyi seviyorum.", "Yüzmeyi", { lemma: "yüzmek", accepted: ["yüzmeyi"] }),
  t("verbal-nouns", "I stopped coming late.", "Gelmeyi bıraktım.", "Gelmeyi", {
    lemma: "gelmek",
    accepted: ["gelmeyi"],
  }),
  t("verbal-nouns", "I love reading.", "Okumayı seviyorum.", "Okumayı", { lemma: "okumak", accepted: ["okumayı"] }),

  t("verbal-nouns-possessive", "I want your coming.", "Gelmeni istiyorum.", "Gelmeni", {
    lemma: "gelmek",
    accepted: ["gelmeni"],
  }),
  t("verbal-nouns-possessive", "I heard about her going.", "Gitmesini duydum.", "Gitmesini", {
    lemma: "gitmek",
    accepted: ["gitmesini"],
  }),
  t("verbal-nouns-possessive", "I want his/her reading.", "Okumasını istiyorum.", "Okumasını", {
    lemma: "okumak",
    accepted: ["okumasını"],
  }),

  t("purpose-mak-icin", "I came in order to learn Turkish.", "Türkçe öğrenmek için geldim.", "öğrenmek için", {
    lemma: "öğrenmek",
  }),
  t("purpose-mak-icin", "She went in order to work.", "O çalışmak için gitti.", "çalışmak için", {
    lemma: "çalışmak",
  }),
  t("purpose-mak-icin", "We stayed in order to read.", "Biz okumak için kaldık.", "okumak için", {
    lemma: "okumak",
  }),
  t("purpose-mak-icin", "He called in order to ask.", "O sormak için aradı.", "sormak için", { lemma: "sormak" }),
  t("purpose-mak-icin", "I am here in order to drink tea.", "Çay içmek için buradayım.", "içmek için", {
    lemma: "içmek",
  }),

  t("before-doing", "Wash your hands before eating.", "Yemeden önce ellerini yıka.", "Yemeden önce", {
    lemma: "yemek",
    accepted: ["yemeden önce"],
  }),
  t("before-doing", "Call me before coming.", "Gelmeden önce ara.", "Gelmeden önce", {
    lemma: "gelmek",
    accepted: ["gelmeden önce"],
  }),
  t("before-doing", "Think before speaking.", "Konuşmadan önce düşün.", "Konuşmadan önce", {
    lemma: "konuşmak",
    accepted: ["konuşmadan önce"],
  }),
  t("before-doing", "Lock the door before going.", "Gitmeden önce kapıyı kilitle.", "Gitmeden önce", {
    lemma: "gitmek",
    accepted: ["gitmeden önce"],
  }),

  t("after-doing", "I walk after eating.", "Yemek yedikten sonra yürürüm.", "yedikten sonra", {
    lemma: "yemek",
  }),
  t("after-doing", "Call me after coming.", "Geldikten sonra ara.", "Geldikten sonra", {
    lemma: "gelmek",
    accepted: ["geldikten sonra"],
  }),
  t("after-doing", "We rested after working.", "Çalıştıktan sonra dinlendik.", "Çalıştıktan sonra", {
    lemma: "çalışmak",
    accepted: ["çalıştıktan sonra"],
  }),
  t("after-doing", "She slept after reading.", "Okuduktan sonra uyudu.", "Okuduktan sonra", {
    lemma: "okumak",
    accepted: ["okuduktan sonra"],
  }),

  t("while-doing", "I listen to music while working.", "Çalışırken müzik dinliyorum.", "Çalışırken", {
    lemma: "çalışmak",
    accepted: ["çalışırken"],
  }),
  t("while-doing", "She smiled while speaking.", "Konuşurken gülümsedi.", "Konuşurken", {
    lemma: "konuşmak",
    accepted: ["konuşurken"],
  }),
  t("while-doing", "Don't talk while eating.", "Yerken konuşma.", "Yerken", { lemma: "yemek", accepted: ["yerken"] }),
  t("while-doing", "I think while walking.", "Yürürken düşünüyorum.", "Yürürken", {
    lemma: "yürümek",
    accepted: ["yürürken"],
  }),

  t("by-doing", "She spoke by smiling.", "Gülerek konuştu.", "Gülerek", { lemma: "gülmek", accepted: ["gülerek"] }),
  t("by-doing", "He answered by writing.", "Yazarak cevap verdi.", "Yazarak", {
    lemma: "yazmak",
    accepted: ["yazarak"],
  }),
  t("by-doing", "We learned by reading.", "Okuyarak öğrendik.", "Okuyarak", {
    lemma: "okumak",
    accepted: ["okuyarak"],
  }),
  t("by-doing", "She explained by understanding.", "Anlayarak anlattı.", "Anlayarak", {
    lemma: "anlamak",
    accepted: ["anlayarak"],
  }),

  t("without-doing", "I left without eating breakfast.", "Kahvaltı yapmadan çıktım.", "yapmadan", {
    lemma: "yapmak",
  }),
  t("without-doing", "She went without saying goodbye.", "Söylemeden gitti.", "Söylemeden", {
    lemma: "söylemek",
    accepted: ["söylemeden"],
  }),
  t("without-doing", "He came without calling.", "Aramadan geldi.", "Aramadan", {
    lemma: "aramak",
    accepted: ["aramadan"],
  }),
  t("without-doing", "We left without waiting.", "Beklemeden gittik.", "Beklemeden", {
    lemma: "beklemek",
    accepted: ["beklemeden", "Beklemeden çıktık", "Biz beklemeden gittik", "Biz beklemeden çıktık"],
  }),
  t("without-doing", "I left home without looking.", "Bakmadan evden çıktım.", "Bakmadan", {
    lemma: "bakmak",
    accepted: ["bakmadan"],
  }),
  t("without-doing", "I went to work without writing anything.", "Hiçbir şey yazmadan işe gittim.", "yazmadan", {
    lemma: "yazmak",
  }),
  t("without-doing", "She spoke without thinking.", "Düşünmeden konuştu.", "Düşünmeden", {
    lemma: "düşünmek",
    accepted: ["düşünmeden"],
  }),
  t("without-doing", "We entered without knocking.", "Çalmadan girdik.", "Çalmadan", {
    lemma: "çalmak",
    accepted: ["çalmadan"],
  }),
  t("without-doing", "I slept without eating.", "Yemeden uyudum.", "Yemeden", {
    lemma: "yemek",
    accepted: ["yemeden"],
  }),
  t("without-doing", "He left without drinking tea.", "Çay içmeden gitti.", "içmeden", {
    lemma: "içmek",
  }),
  t("without-doing", "They went out without reading the message.", "Mesajı okumadan dışarı çıktılar.", "okumadan", {
    lemma: "okumak",
  }),
  t("without-doing", "I answered without understanding the question.", "Soruyu anlamadan cevap verdim.", "anlamadan", {
    lemma: "anlamak",
  }),

  t("basic-participles", "The man who is coming is my teacher.", "Gelen adam benim öğretmenim.", "Gelen", {
    lemma: "gelmek",
    accepted: ["gelen"],
  }),
  t("basic-participles", "The student who reads is here.", "Okuyan öğrenci burada.", "Okuyan", {
    lemma: "okumak",
    accepted: ["okuyan"],
  }),
  t("basic-participles", "The person who understands will pass.", "Anlayan geçer.", "Anlayan", {
    lemma: "anlamak",
    accepted: ["anlayan"],
  }),
  t("basic-participles", "The child who is going home cried.", "Giden çocuk ağladı.", "Giden", {
    lemma: "gitmek",
    accepted: ["giden"],
  }),

  t("basic-indirect-speech", "I know that he did it.", "Onun yaptığını biliyorum.", "yaptığını", {
    lemma: "yapmak",
  }),
  t("basic-indirect-speech", "I heard that she came.", "Onun geldiğini duydum.", "geldiğini", { lemma: "gelmek" }),
  t("basic-indirect-speech", "I saw that they read it.", "Onların okuduğunu gördüm.", "okuduğunu", {
    lemma: "okumak",
  }),
  t("basic-indirect-speech", "I know that he wrote it.", "Onun yazdığını biliyorum.", "yazdığını", {
    lemma: "yazmak",
  }),

  // ── Voice (lexical curated) ───────────────────────────────────────────────
  t("basic-causative", "You (sg) made someone read.", "Sen kitabı okuttun.", "okuttun", { lemma: "okutmak" }),
  t("basic-causative", "I made someone read the book.", "Çocuğa kitabı okuttum.", "okuttum", { lemma: "okutmak" }),
  t("basic-causative", "She made someone write a letter.", "Mektubu yazdırdı.", "yazdırdı", { lemma: "yazdırmak" }),
  t("basic-causative", "We made someone do the work.", "İşi yaptırdık.", "yaptırdık", { lemma: "yaptırmak" }),
  t("basic-causative", "I made the child drink water.", "Çocuğa su içirdim.", "içirdim", { lemma: "içirmek" }),

  // Lemma is the active verb — learner must form the passive themselves.
  t("basic-passive", "The food was made.", "Yemek yapıldı.", "yapıldı", { lemma: "yapmak" }),
  t("basic-passive", "The letter was written.", "Mektup yazıldı.", "yazıldı", { lemma: "yazmak" }),
  t("basic-passive", "The book was read.", "Kitap okundu.", "okundu", { lemma: "okumak" }),
  t("basic-passive", "The water was drunk.", "Su içildi.", "içildi", { lemma: "içmek" }),
  t("basic-passive", "This topic was discussed.", "Bu konu konuşuldu.", "konuşuldu", { lemma: "konuşmak" }),

  t("reciprocal-verbs", "We are seeing each other tomorrow.", "Yarın görüşüyoruz.", "görüşüyoruz", {
    lemma: "görüşmek",
  }),
  t("reciprocal-verbs", "They are corresponding.", "Yazışıyorlar.", "Yazışıyorlar", {
    lemma: "yazışmak",
    accepted: ["yazışıyorlar"],
  }),
  t("reciprocal-verbs", "You (pl) meet each other often.", "Sık sık görüşüyorsunuz.", "görüşüyorsunuz", {
    lemma: "görüşmek",
  }),

  t("reflexive-verbs", "I am getting dressed.", "Giyiniyorum.", "Giyiniyorum", {
    lemma: "giyinmek",
    accepted: ["giyiniyorum"],
  }),
  t("reflexive-verbs", "She is washing herself.", "Yıkanıyor.", "Yıkanıyor", {
    lemma: "yıkanmak",
    accepted: ["yıkanıyor"],
  }),
  t("reflexive-verbs", "He is combing himself.", "O taranıyor.", "taranıyor", {
    lemma: "taranmak",
    accepted: ["Taranıyor", "Taranıyor."],
  }),

  // ── Comparisons (sentence-level curated) ──────────────────────────────────
  t("comparisons-daha-en", "I am taller than you.", "Senden daha uzunum.", "daha uzunum", {
    lemma: "uzun",
    accepted: ["Daha uzunum"],
  }),
  t("comparisons-daha-en", "This is the most beautiful.", "Bu en güzel.", "en güzel", {
    lemma: "güzel",
    // Optional predicative -dir is emphatic/formal and equally correct here.
    accepted: ["en güzeldir", "En güzel", "En güzeldir"],
  }),
  t("comparisons-daha-en", "She runs faster.", "Daha hızlı koşuyor.", "Daha hızlı", {
    lemma: "hızlı",
    accepted: ["daha hızlı"],
  }),

  t("basic-comparison", "This book is better.", "Bu kitap daha iyi.", "daha iyi", { lemma: "iyi" }),
  t("basic-comparison", "He is younger than me.", "Benden daha genç.", "daha genç", { lemma: "genç" }),
  t("basic-comparison", "Istanbul is bigger.", "İstanbul daha büyük.", "daha büyük", { lemma: "büyük" }),

  t("comparisons-ablative", "She is younger than me.", "Benden daha genç.", "Benden", { lemma: "ben" }),
  t("comparisons-ablative", "This is cheaper than that.", "Bundan daha ucuz.", "Bundan", {
    lemma: "bu",
    accepted: ["bundan"],
  }),
  t("similarity-gibi", "It is soft like cotton.", "Pamuk gibi yumuşak.", "Pamuk gibi", { lemma: "pamuk" }),
  t("similarity-gibi", "He runs like the wind.", "Rüzgâr gibi koşuyor.", "Rüzgâr gibi", {
    lemma: "rüzgâr",
    accepted: ["rüzgar gibi", "Rüzgar gibi"],
  }),
  t("equality-kadar", "I am as fast as you.", "Senin kadar hızlıyım.", "Senin kadar", { lemma: "sen" }),
  t("equality-kadar", "She works as much as him.", "Onun kadar çalışıyor.", "Onun kadar", { lemma: "o" }),
]

const byStructure = new Map<string, AssessmentTemplate[]>()
for (const template of ASSESSMENT_TEMPLATES) {
  const list = byStructure.get(template.structureId) ?? []
  list.push(template)
  byStructure.set(template.structureId, list)
}

export function structuresWithAssessmentBank(): string[] {
  return [...byStructure.keys()].sort()
}

export function hasAssessmentBank(structureId: string): boolean {
  return (byStructure.get(structureId)?.length ?? 0) > 0
}

export function templatesForStructure(structureId: string): AssessmentTemplate[] {
  return byStructure.get(structureId) ?? []
}

export function assessmentBankCoverage(): { structureId: string; count: number }[] {
  return structuresWithAssessmentBank().map((structureId) => ({
    structureId,
    count: templatesForStructure(structureId).length,
  }))
}

function looksLikeInfinitive(value: string) {
  const n = value.trim().toLocaleLowerCase("tr-TR")
  return n.endsWith("mak") || n.endsWith("mek")
}

/**
 * Hard validation — unvalidated templates must never reach the learner.
 */
export function validateQuestion(template: AssessmentTemplate): { ok: true } | { ok: false; reason: string } {
  const { structureId, english, turkishFull, blank } = template
  if (!structureId?.trim()) return { ok: false, reason: "missing structureId" }
  if (!english?.trim()) return { ok: false, reason: "missing english" }
  if (!turkishFull?.trim()) return { ok: false, reason: "missing turkishFull" }
  if (!blank?.trim()) return { ok: false, reason: "empty blank" }
  if (!turkishFull.includes(blank)) {
    return { ok: false, reason: `blank "${blank}" not found in turkishFull` }
  }

  const blankNorm = blank.trim().toLocaleLowerCase("tr-TR")
  const lemmaNorm = template.lemma?.trim().toLocaleLowerCase("tr-TR")

  if (looksLikeInfinitive(blankNorm) && !INFINITIVE_OK.has(structureId)) {
    // purpose-mak-icin may be "öğrenmek için" (infinitive + için) — allowed via INFINITIVE_OK
    return { ok: false, reason: `bare infinitive blank not allowed for ${structureId}` }
  }

  if (structureId === "purpose-mak-icin") {
    if (!blankNorm.includes("için") && looksLikeInfinitive(blankNorm)) {
      return { ok: false, reason: "purpose blank should include için (e.g. öğrenmek için)" }
    }
  }

  // Reject citation stem alone for tensed verb topics when lemma is an infinitive
  if (
    lemmaNorm &&
    looksLikeInfinitive(lemmaNorm) &&
    !STEM_OK.has(structureId) &&
    blankNorm === stripInfinitive(lemmaNorm)
  ) {
    return { ok: false, reason: "blank is bare citation stem" }
  }

  return { ok: true }
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}

function templateToItem(template: AssessmentTemplate): ValidatedAssessmentItem {
  const structure = getStructure(template.structureId)
  const turkishPrompt = template.turkishFull.replace(template.blank, "______")
  const accepted = [
    ...new Set(
      [template.blank, ...(template.accepted ?? [])]
        .map((part) => part.trim())
        .filter(Boolean)
        .flatMap((part) => {
          const bare = part.replace(/[?!]+$/g, "")
          return part === bare ? [part] : [part, bare]
        }),
    ),
  ]
  return {
    structureId: template.structureId,
    structureLabel: structure?.label ?? template.structureId,
    verb: template.lemma ?? "",
    verbEnglish: template.english,
    person: "3sg" as Person,
    personLabel: "",
    promptEnglish: template.english,
    englishPrompt: template.english,
    expected: template.blank,
    accepted,
    sentenceCue: turkishPrompt,
    turkishPrompt,
    kind: "blank",
    turkishFull: template.turkishFull,
  }
}

/**
 * Build validated assessment/diagnostic blanks for the given structures.
 * Never falls back to generic pronoun+verb conjugation drills.
 */
export function buildAssessmentBankItems(
  structureIds: string[],
  perStructure = 4,
): ValidatedAssessmentItem[] {
  const items: ValidatedAssessmentItem[] = []

  for (const structureId of structureIds) {
    const pool = shuffleInPlace(
      templatesForStructure(structureId).filter((template) => validateQuestion(template).ok),
    )
    const picked: ValidatedAssessmentItem[] = []
    const seen = new Set<string>()

    for (const template of pool) {
      if (picked.length >= perStructure) break
      const key = template.blank.trim().toLocaleLowerCase("tr-TR")
      if (seen.has(key)) continue
      seen.add(key)
      picked.push(templateToItem(template))
    }

    // Prefer fewer validated items over padding with unsafe generics.
    items.push(...picked)
  }

  return shuffleInPlace(items)
}
