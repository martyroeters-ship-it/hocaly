export type GrammarLesson = {
  meaning: string
  construction: string
  sentences: { turkish: string; english: string }[]
  /** Step-by-step build path shown in the topic header, e.g. gelmek → gel → … */
  formulation?: string
}

/** Header build chains — shown instead of a full example sentence. */
const FORMULATIONS: Record<string, string> = {
  "personal-pronouns": "ben · sen · o · biz · siz · onlar",
  "demonstrative-pronouns": "bu · şu · o",
  "nominal-sentences": "öğrenci → öğrenciyim",
  "nominal-negation": "doktor → doktor değilim",
  "nominal-questions": "öğrenci → öğrenci misin?",
  "var-yok": "süt → süt var / süt yok",
  "question-words": "kim · ne · nerede · ne zaman · neden · nasıl",
  "basic-word-order": "özne → nesne → fiil",
  plural: "kitap → kitaplar",
  locative: "ev → evde",
  dative: "okul → okula",
  ablative: "okul → okuldan",
  accusative: "kitap → kitabı",
  genitive: "kitap → kitabın",
  "possessive-suffixes": "ev → evim",
  "possessive-constructions": "benim + ev → benim evim",
  "consonant-mutation": "kitap + ı → kitabı",
  "vowel-harmony": "gel-di · bak-tı · gör-dü · gül-dü",
  "buffer-consonants": "oku + yor → okuyor",
  "present-continuous": "gelmek → gel → geliyor",
  "present-continuous-negation": "gelmek → gel → gelmiyor",
  "present-continuous-questions": "gelmek → gel → geliyor → geliyor mu?",
  "simple-past": "gelmek → gel → geldi",
  "simple-past-negation": "gelmek → gel → gelmedi",
  "simple-past-questions": "gelmek → gel → geldi → geldi mi?",
  imperative: "gelmek → gel → gel! / gelin!",
  "basic-verb-negation": "gelmek → gel → gelme!",
  "auxiliary-verbs": "teşekkür + etmek → teşekkür etmek",
  adjectives: "büyük + ev → büyük ev",
  "adverbs-frequency": "her zaman · bazen · hiç",
  "numbers-ordinals": "bir → birinci",
  "time-expressions-a1": "saat üçte · pazartesi · ocakta",
  "basic-conjunctions": "ve · ama · çünkü · veya",
  "basic-postpositions": "ile · için",
  "basic-comparison": "büyük → daha büyük",
  "existence-possession": "arabam → arabam var",
  future: "gelmek → gel → gelecek",
  "future-negation": "gelmek → gel → gelmeyecek",
  "future-questions": "gelmek → gel → gelecek → gelecek mi?",
  aorist: "gelmek → gel → gelir",
  "aorist-negation": "gelmek → gel → gelmez",
  "aorist-questions": "gelmek → gel → gelir → gelir mi?",
  "reported-past": "gelmek → gel → gelmiş",
  "reported-past-negation": "gelmek → gel → gelmemiş",
  "reported-past-questions": "gelmek → gel → gelmiş → gelmiş mi?",
  ability: "gelmek → gel → gelebilir",
  inability: "gelmek → gel → gelemem",
  necessity: "gelmek → gel → gelmeli",
  "obligation-zorunda": "gelmek → gelmek zorunda",
  "suggestion-lets": "gelmek → gel → gelelim",
  "basic-conditional": "gelmek → gel → gelirsem",
  "comparisons-daha-en": "uzun → daha uzun · en uzun",
  "similarity-gibi": "pamuk → pamuk gibi",
  "equality-kadar": "sen → senin kadar",
  "comparisons-ablative": "ben → benden daha…",
  "intensifying-adjectives": "beyaz → bembeyaz",
  "diminutive-adjectives": "küçük → küçücük",
  "reflexive-pronouns": "ben → kendim",
  "indefinite-pronouns": "herkes · biri · hiç kimse",
  infinitives: "yap → yapmak",
  "verbal-nouns": "yüzmek → yüzmeyi",
  "verbal-nouns-possessive": "gelmek → gelmeni",
  "purpose-mak-icin": "öğrenmek → öğrenmek için",
  "before-doing": "yemek → ye → yemeden → yemeden önce",
  "after-doing": "gelmek → gel → geldik → geldikten → geldikten sonra",
  "while-doing": "çalışmak → çalış → çalışırken",
  "by-doing": "gülmek → gül → gülerek",
  "without-doing": "bakmak → bak → bakmadan",
  "basic-participles": "gelmek → gel → gelen",
  "reciprocal-verbs": "görüşmek → görüşüyorlar",
  "reflexive-verbs": "giyinmek → giyiniyorum",
  "time-expressions-a2": "önce · sonra · beri · boyunca",
  "duration-dir": "iki yıl → iki yıldır",
  "since-beri": "pazartesi → pazartesiden beri",
  "until-kadar": "akşam → akşama kadar",
  "cause-reason": "çünkü · bu yüzden",
  contrast: "ama · ancak · fakat",
  "purpose-diye": "anlıyayım diye",
  "direct-speech": "“Gel” dedi.",
  "basic-indirect-speech": "geldiğini söyledi",
  probability: "belki · herhalde · galiba",
  preference: "tercih etmek · …mektense",
  "basic-passive": "yapmak → yapıl → yapıldı",
  "basic-causative": "okumak → okut → okuttu",
}

function lesson(
  meaning: string,
  construction: string,
  sentences: [turkish: string, english: string][],
): GrammarLesson {
  return {
    meaning,
    construction,
    sentences: sentences.map(([turkish, english]) => ({ turkish, english })),
  }
}

const LESSONS: Record<string, GrammarLesson> = {
  "personal-pronouns": lesson(
    "Personal pronouns identify who performs an action or has a quality.",
    "Use ben (I), sen (you, singular), o (he/she/it), biz (we), siz (you, plural or polite), and onlar (they). Turkish often omits them because the verb ending already shows the person.",
    [["Ben öğretmenim.", "I am a teacher."], ["Sen çok hızlı koşuyorsun.", "You run very fast."], ["Onlar bugün evde.", "They are at home today."]],
  ),
  "demonstrative-pronouns": lesson(
    "Demonstratives point to people or things: this, that, or that over there.",
    "Use bu for something near, şu for something being pointed out or at a middle distance, and o for something farther away. Before a noun they do not take a plural suffix: bu kitap, şu ev, o çocuk.",
    [["Bu benim çantam.", "This is my bag."], ["Şu otobüs çok kalabalık.", "That bus is very crowded."], ["O bina bir hastane.", "That building is a hospital."]],
  ),
  "nominal-sentences": lesson(
    "Nominal sentences say that someone or something is a noun or adjective without a separate present-tense verb “to be.”",
    "Add personal endings to the noun or adjective: -(y)ım/-(y)im/-(y)um/-(y)üm, -sın/-sin/-sun/-sün, no ending for o, -(y)ız/-(y)iz/-(y)uz/-(y)üz, and -sınız/-siniz/-sunuz/-sünüz. Use buffer y after a vowel.",
    [["Ben yorgunum.", "I am tired."], ["Sen öğrencisin.", "You are a student."], ["Biz hazırız.", "We are ready."], ["Siz çok naziksiniz.", "You are very kind."]],
  ),
  "nominal-negation": lesson(
    "Değil makes a noun or adjective sentence negative: “is/am/are not.”",
    "Put değil after the noun or adjective and attach the personal ending to değil: değilim, değilsin, değil, değiliz, değilsiniz, değiller.",
    [["Ben doktor değilim.", "I am not a doctor."], ["Bu oda büyük değil.", "This room is not big."], ["Biz geç değiliz.", "We are not late."]],
  ),
  "nominal-questions": lesson(
    "The question particle asks whether a noun or adjective statement is true.",
    "Place mı/mi/mu/mü after the noun or adjective, following four-way vowel harmony. Write it separately, then add the personal ending: miyim, misin, mi, miyiz, misiniz.",
    [["Sen öğrenci misin?", "Are you a student?"], ["Bu çorba sıcak mı?", "Is this soup hot?"], ["Siz hazır mısınız?", "Are you ready?"]],
  ),
  "var-yok": lesson(
    "Var says that something exists; yok says that it does not exist.",
    "Use the item as the subject, often with a location in -da/-de: Evde süt var. For questions, add separate mı/mi/mu/mü: Süt var mı?",
    [["Masada bir kitap var.", "There is a book on the table."], ["Evde kimse yok.", "There is nobody at home."], ["Yakında market var mı?", "Is there a market nearby?"]],
  ),
  "question-words": lesson(
    "Question words ask for specific information such as who, what, where, when, why, or how.",
    "Put kim, ne, nerede, ne zaman, neden/niçin, nasıl, hangi, or kaç in the position of the missing information. Do not normally add mı/mi to the same question.",
    [["Bu kim?", "Who is this?"], ["Nerede çalışıyorsun?", "Where do you work?"], ["Kaç kardeşin var?", "How many siblings do you have?"]],
  ),
  "basic-word-order": lesson(
    "Neutral Turkish word order is Subject–Object–Verb, with the verb usually at the end.",
    "Build the sentence as subject + time/place + object + verb. Elements can move for emphasis, but beginners should keep the conjugated verb last.",
    [["Ben her sabah kahve içiyorum.", "I drink coffee every morning."], ["Ayşe okulda Türkçe öğreniyor.", "Ayşe is learning Turkish at school."], ["Biz akşam film izledik.", "We watched a film in the evening."]],
  ),
  plural: lesson(
    "The plural suffix marks more than one person or thing.",
    "Add -lar after a back vowel (a, ı, o, u) and -ler after a front vowel (e, i, ö, ü). After an exact number, the noun normally stays singular: üç kitap.",
    [["Bahçede kediler oynuyor.", "Cats are playing in the garden."], ["Kitaplar masada.", "The books are on the table."], ["İki öğrenci geldi.", "Two students came."]],
  ),
  locative: lesson(
    "The locative case expresses “in,” “at,” or “on.”",
    "Add -da/-de by vowel harmony; use -ta/-te after a voiceless consonant (ç, f, h, k, p, s, ş, t). After a third-person possessive suffix, insert n: evinde.",
    [["Anahtar çantada.", "The key is in the bag."], ["Çocuklar parkta oynuyor.", "The children are playing in the park."], ["Annem evinde dinleniyor.", "My mother is resting in her home."]],
  ),
  dative: lesson(
    "The dative case marks movement toward a destination or a recipient: “to” or “toward.”",
    "Add -a after a back vowel and -e after a front vowel. Insert buffer y after a vowel (arabaya), and use n after a third-person possessive suffix (evine); stem softening may occur.",
    [["Okula gidiyorum.", "I am going to school."], ["Arkadaşıma mesaj yazdım.", "I wrote a message to my friend."], ["Arabaya bindik.", "We got into the car."]],
  ),
  ablative: lesson(
    "The ablative case expresses movement from a place, a source, or separation.",
    "Add -dan/-den by vowel harmony; use -tan/-ten after a voiceless consonant. Use buffer n after a third-person possessive suffix: evinden.",
    [["İşten saat altıda çıkıyorum.", "I leave work at six."], ["Ankara'dan geliyorum.", "I come from Ankara."], ["Dolaptan su aldım.", "I took water from the refrigerator."]],
  ),
  accusative: lesson(
    "The accusative marks a specific or known direct object.",
    "Add -ı/-i/-u/-ü by four-way vowel harmony. Insert y after a vowel (arabayı), use n after a third-person possessive suffix (kitabını), and apply stem softening where needed (kitap → kitabı).",
    [["Kitabı okuyorum.", "I am reading the book."], ["Kapıyı kapatır mısın?", "Can you close the door?"], ["Onu dün gördüm.", "I saw him/her yesterday."]],
  ),
  genitive: lesson(
    "The genitive marks the possessor and means “of” or “belonging to.”",
    "Add -ın/-in/-un/-ün by four-way harmony; insert n after a vowel: arabanın. The possessed noun normally also takes a possessive suffix: Ali'nin kitabı.",
    [["Evin kapısı açık.", "The door of the house is open."], ["Ayşe'nin telefonu yeni.", "Ayşe's phone is new."], ["Arabanın rengi mavi.", "The car's color is blue."]],
  ),
  "possessive-suffixes": lesson(
    "Possessive suffixes show who owns or is connected with a noun.",
    "After consonants use -(ı)m/-(i)m/-(u)m/-(ü)m, -(ı)n/-(i)n/-(u)n/-(ü)n, -(s)ı/-(s)i/-(s)u/-(s)ü, -(ı)mız/-(i)miz/-(u)muz/-(ü)müz, -(ı)nız/-(i)niz/-(u)nuz/-(ü)nüz, and -ları/-leri. Vowel-final nouns use the forms without the initial vowel and s for third person.",
    [["Benim adım Elif.", "My name is Elif."], ["Senin evin çok güzel.", "Your house is very beautiful."], ["Bizim öğretmenimiz Ankara'da yaşıyor.", "Our teacher lives in Ankara."]],
  ),
  "possessive-constructions": lesson(
    "A possessive construction links an owner to something owned: “X's Y.”",
    "Mark the possessor with genitive -(n)ın/-(n)in/-(n)un/-(n)ün and the possessed noun with -(s)ı/-(s)i/-(s)u/-(s)ü or another matching possessive ending.",
    [["Okulun kapısı kapalı.", "The school's door is closed."], ["Mert'in annesi doktor.", "Mert's mother is a doctor."], ["Kedinin gözleri yeşil.", "The cat's eyes are green."]],
  ),
  "consonant-mutation": lesson(
    "Many words soften a final voiceless consonant before a vowel-initial suffix.",
    "Common changes are p→b, ç→c, t→d, and k→ğ or g: kitap→kitabı, ağaç→ağacı, kanat→kanadı, çocuk→çocuğu. Short words and proper nouns often do not soften.",
    [["Kitabı çantama koydum.", "I put the book in my bag."], ["Ağacın altında oturuyoruz.", "We are sitting under the tree."], ["Çocuğa bir elma verdim.", "I gave the child an apple."]],
  ),
  "vowel-harmony": lesson(
    "Vowel harmony makes suffix vowels agree with the last vowel of the word.",
    "Two-way A harmony chooses a after a, ı, o, u and e after e, i, ö, ü. Four-way I harmony chooses ı after a/ı, i after e/i, u after o/u, and ü after ö/ü.",
    [["Çocuklar bahçede oynuyor.", "The children are playing in the garden."], ["Evler çok eski.", "The houses are very old."], ["Gözüm biraz ağrıyor.", "My eye hurts a little."]],
  ),
  "buffer-consonants": lesson(
    "Buffer consonants prevent two vowels from meeting when a suffix is added.",
    "Use y with many case and tense suffixes (arabaya), s before the third-person possessive suffix (arabası), and n after that possessive suffix or in the genitive of vowel-final words (arabasına, arabanın).",
    [["Masaya bir tabak koydum.", "I put a plate on the table."], ["Bu Ayşe'nin arabası.", "This is Ayşe's car."], ["Kedi yuvasında uyuyor.", "The cat is sleeping in its bed."]],
  ),
  "present-continuous": lesson(
    "The present continuous describes actions happening now or temporary ongoing situations.",
    "Use the verb stem + -ıyor/-iyor/-uyor/-üyor + personal ending. A final a/e usually narrows before -yor (başla→başlıyor, bekle→bekliyor); de- and ye- become diyor and yiyor.",
    [["Şimdi kitap okuyorum.", "I am reading a book now."], ["Babam yemek yapıyor.", "My father is cooking."], ["Biz Türkçe öğreniyoruz.", "We are learning Turkish."]],
  ),
  "present-continuous-negation": lesson(
    "This form says that an action is not happening now.",
    "Add negative -ma/-me to the stem; before -yor it becomes -mıyor/-miyor/-muyor/-müyor, followed by the personal ending.",
    [["Bugün çalışmıyorum.", "I am not working today."], ["Ayşe televizyon izlemiyor.", "Ayşe is not watching television."], ["Biz sizi beklemiyoruz.", "We are not waiting for you."]],
  ),
  "present-continuous-questions": lesson(
    "This form asks whether an action is happening now.",
    "Use the affirmative -ıyor/-iyor/-uyor/-üyor form, then the separate question particle mu/mü and attach the personal ending to the particle: geliyor musun, okuyor muyuz?",
    [["Beni dinliyor musun?", "Are you listening to me?"], ["Otobüs geliyor mu?", "Is the bus coming?"], ["Siz burada mı çalışıyorsunuz?", "Do you work here?"]],
  ),
  "simple-past": lesson(
    "The simple past describes a completed event the speaker witnessed or knows directly.",
    "Add -dı/-di/-du/-dü by four-way harmony, or -tı/-ti/-tu/-tü after a voiceless consonant, then the personal ending: geldim, baktın, okuduk.",
    [["Dün erken uyudum.", "I slept early yesterday."], ["Mert bize geldi.", "Mert came to us."], ["Hafta sonu müzeyi gezdik.", "We visited the museum at the weekend."]],
  ),
  "simple-past-negation": lesson(
    "This form says that a definite past action did not happen.",
    "Add -ma/-me to the verb stem, then past -dı/-di and the personal ending. Because the negative suffix ends in a vowel, the past consonant is d: gelmedim, yapmadık.",
    [["Dün okula gitmedim.", "I did not go to school yesterday."], ["O kahvaltı yapmadı.", "He/She did not have breakfast."], ["Biz filmi izlemedik.", "We did not watch the film."]],
  ),
  "simple-past-questions": lesson(
    "This form asks whether a completed past action happened.",
    "Use the past form + separate mı/mi/mu/mü; personal endings usually stay on the past verb: geldin mi, okudunuz mu, yaptı mı?",
    [["Dün beni aradın mı?", "Did you call me yesterday?"], ["Otobüs geldi mi?", "Did the bus arrive?"], ["Ödevinizi yaptınız mı?", "Did you do your homework?"]],
  ),
  imperative: lesson(
    "The imperative gives commands, requests, or instructions.",
    "Use the bare stem for informal singular commands (gel). Add -(y)ın/-(y)in/-(y)un/-(y)ün for plural or polite commands (gelin, okuyun), and -sın/-sin/-sun/-sün for third person.",
    [["Lütfen buraya gel.", "Please come here."], ["Kapıyı kapatın.", "Close the door, please."], ["Ali biraz dinlensin.", "Let Ali rest a little."]],
  ),
  "basic-verb-negation": lesson(
    "The suffix -ma/-me negates a verb and can also make a negative command.",
    "Add -ma after a back vowel or -me after a front vowel before tense endings. For an informal negative command, use stem + -ma/-me: yapma, gitme.",
    [["Burada koşma!", "Do not run here!"], ["Ben et yemiyorum.", "I do not eat meat."], ["Geç kalmayın.", "Do not be late."]],
  ),
  "auxiliary-verbs": lesson(
    "Etmek and olmak combine with nouns or adjectives to form common compound verbs.",
    "Use noun/adjective + etmek for doing or causing (yardım etmek) and + olmak for becoming or being (hasta olmak). Conjugate etmek or olmak; some compounds show sound changes, such as hissetmek.",
    [["Arkadaşıma yardım ettim.", "I helped my friend."], ["Kardeşim hasta oldu.", "My sibling became ill."], ["Lütfen dikkat et.", "Please pay attention."]],
  ),
  adjectives: lesson(
    "Adjectives describe nouns and normally come before them.",
    "Use adjective + noun, often with bir: güzel bir ev. Adjectives do not agree with the noun in number or case; when used as predicates, they take nominal personal endings.",
    [["Kırmızı bir elbise aldım.", "I bought a red dress."], ["Bu büyük ev çok eski.", "This big house is very old."], ["Hava bugün sıcak.", "The weather is hot today."]],
  ),
  "adverbs-frequency": lesson(
    "Frequency adverbs say how often an action happens.",
    "Place her zaman, genellikle, sık sık, bazen, nadiren, or hiç before the verb or near the time phrase. Hiç normally appears with a negative verb when it means “never.”",
    [["Her zaman erken kalkarım.", "I always get up early."], ["Bazen arkadaşlarımla buluşuyorum.", "I sometimes meet my friends."], ["Hiç kahve içmem.", "I never drink coffee."]],
  ),
  "numbers-ordinals": lesson(
    "Cardinal numbers count things; ordinal numbers show order: first, second, and so on.",
    "Add -(ı)ncı/-(i)nci/-(u)ncu/-(ü)ncü by four-way harmony. After a vowel use -ncı/-nci/-ncu/-ncü: iki→ikinci, altı→altıncı.",
    [["Birinci katta oturuyorum.", "I live on the first floor."], ["Otobüs üçüncü durakta durdu.", "The bus stopped at the third stop."], ["Bugün yarışın ikinci günü.", "Today is the second day of the race."]],
  ),
  "time-expressions-a1": lesson(
    "Basic time expressions say when something happens using clock times, days, and months.",
    "Use saat + number; add locative -da/-de/-ta/-te for “at” (saat üçte). Days can stand alone or use günü, and months take the locative for “in”: temmuzda.",
    [["Ders saat dokuzda başlıyor.", "The lesson starts at nine."], ["Pazartesi günü çalışıyorum.", "I work on Monday."], ["Temmuzda tatile gidiyoruz.", "We are going on holiday in July."]],
  ),
  "basic-conjunctions": lesson(
    "Conjunctions connect words or clauses and show addition, choice, contrast, or reason.",
    "Use ve for “and,” ama/fakat for “but,” veya/ya da for “or,” and çünkü before the reason clause. They are separate words and take no suffix.",
    [["Çay ve kahve aldım.", "I bought tea and coffee."], ["Yorgunum ama mutluyum.", "I am tired but happy."], ["Evde kaldım çünkü hastaydım.", "I stayed home because I was ill."]],
  ),
  "basic-postpositions": lesson(
    "Postpositions follow a noun or pronoun and express relations such as “with” and “for.”",
    "Use ile after a noun or attach -(y)la/-(y)le (arkadaşımla). Use için after a noun; personal pronouns usually take genitive forms: benim için, seninle.",
    [["Arkadaşımla sinemaya gittim.", "I went to the cinema with my friend."], ["Bu hediye senin için.", "This gift is for you."], ["Otobüs ile işe gidiyorum.", "I go to work by bus."]],
  ),
  "basic-comparison": lesson(
    "Daha compares qualities (“more”), and en gives the highest degree (“most”).",
    "Put daha before an adjective for a comparative and en before an adjective for a superlative. The comparison standard can be omitted when it is clear.",
    [["Bu çanta daha ucuz.", "This bag is cheaper."], ["Mavi araba daha hızlı.", "The blue car is faster."], ["Ece sınıfın en uzun öğrencisi.", "Ece is the tallest student in the class."]],
  ),
  "existence-possession": lesson(
    "Turkish expresses “have” and “do not have” with a possessed noun plus var or yok.",
    "Use possessor in the genitive + noun with a possessive suffix + var/yok: benim kitabım var, onun arabası yok. Ask with var mı/yok mu.",
    [["Benim iki kardeşim var.", "I have two siblings."], ["Onun arabası yok.", "He/She does not have a car."], ["Sizin zamanınız var mı?", "Do you have time?"]],
  ),
  future: lesson(
    "The future tense expresses plans, intentions, and predictions.",
    "Add -(y)acak/-(y)ecek to the stem, then personal endings. Insert y after a vowel; k often softens before a vowel-initial personal ending: yapacağım, geleceğiz.",
    [["Yarın seni arayacağım.", "I will call you tomorrow."], ["Hafta sonu yağmur yağacak.", "It will rain at the weekend."], ["Gelecek yıl taşınacağız.", "We will move next year."]],
  ),
  "future-negation": lesson(
    "This form says that an action will not happen.",
    "Add negative -ma/-me + -(y)acak/-(y)ecek + personal ending: gelmeyeceğim, yapmayacaklar. The buffer y connects the two vowel-initial parts.",
    [["Yarın çalışmayacağım.", "I will not work tomorrow."], ["O toplantıya gelmeyecek.", "He/She will not come to the meeting."], ["Bu akşam dışarı çıkmayacağız.", "We will not go out this evening."]],
  ),
  "future-questions": lesson(
    "This form asks about a future action, plan, or prediction.",
    "Use the future stem + separate mı/mi; attach personal endings to the question particle for first and second persons: gelecek misin, yapacak mıyız? Third person is gelecek mi?",
    [["Yarın bize gelecek misin?", "Will you come to us tomorrow?"], ["Yağmur yağacak mı?", "Will it rain?"], ["Bu yaz tatile gidecek misiniz?", "Will you go on holiday this summer?"]],
  ),
  aorist: lesson(
    "The aorist expresses habits, routines, general truths, and sometimes willingness.",
    "Use -r after vowel-final stems; many one-syllable consonant-final stems take -ar/-er, while many longer stems take -ır/-ir/-ur/-ür. Add personal endings; common verbs may be irregular, such as gel→gelir and al→alır.",
    [["Her sabah erken kalkarım.", "I get up early every morning."], ["Su yüz derecede kaynar.", "Water boils at one hundred degrees."], ["Babam akşamları kitap okur.", "My father reads books in the evenings."]],
  ),
  "aorist-negation": lesson(
    "The negative aorist denies habits, general facts, or willingness.",
    "Use stem + -maz/-mez for most persons, then personal endings: yapmazsın, gelmezler. First-person forms are -mam/-mem and -mayız/-meyiz: gelmem, yapmayız.",
    [["Ben et yemem.", "I do not eat meat."], ["O pazar günleri çalışmaz.", "He/She does not work on Sundays."], ["Biz geç kalmayız.", "We are not usually late."]],
  ),
  "aorist-questions": lesson(
    "Aorist questions ask about habits, general tendencies, or willingness.",
    "Use the affirmative aorist + separate mı/mi/mu/mü, with personal endings on the particle: gelir misin, okur musunuz? Third person is gelir mi?",
    [["Her gün yürür müsün?", "Do you walk every day?"], ["Bana yardım eder misiniz?", "Would you help me?"], ["Bu otobüs merkeze gider mi?", "Does this bus go to the center?"]],
  ),
  "reported-past": lesson(
    "The reported past describes events learned from others, inferred from evidence, or discovered with surprise.",
    "Add -mış/-miş/-muş/-müş by four-way harmony, then personal endings: gelmişim, yapmışsın, uyumuş. It contrasts with directly witnessed -dı.",
    [["Ali dün buraya gelmiş.", "Apparently Ali came here yesterday."], ["Gece çok kar yağmış.", "It seems that it snowed a lot at night."], ["Sen bu kitabı okumuşsun.", "I hear you have read this book."]],
  ),
  "reported-past-negation": lesson(
    "This form reports or infers that a past action did not happen.",
    "Add negative -ma/-me + -mış/-miş + personal ending: gelmemiş, yapmamışsınız. Harmony is determined by the negative suffix.",
    [["Ayşe bugün okula gelmemiş.", "Apparently Ayşe did not come to school today."], ["Çocuk kahvaltı yapmamış.", "It seems the child did not have breakfast."], ["Onlar filmi izlememişler.", "I hear they did not watch the film."]],
  ),
  "reported-past-questions": lesson(
    "This form asks about an event that the speaker did not witness directly.",
    "Use reported past -mış/-miş/-muş/-müş + separate mı/mi/mu/mü. Personal endings remain on the reported-past form: gelmiş mi, okumuş musun?",
    [["Mert eve gelmiş mi?", "Has Mert apparently come home?"], ["Bu yemeği daha önce yemiş misin?", "Have you eaten this dish before?"], ["Onlar taşınmışlar mı?", "Have they moved, from what you heard?"]],
  ),
  ability: lesson(
    "The ability form expresses being able to do something or the possibility that it may happen.",
    "Add -(y)abil/-(y)ebil to the stem, then a tense and personal ending. Insert y after a vowel: yapabilirim, okuyabilir, gelebiliriz.",
    [["Türkçe konuşabilirim.", "I can speak Turkish."], ["Burada oturabilir miyiz?", "Can we sit here?"], ["Yarın yağmur yağabilir.", "It may rain tomorrow."]],
  ),
  inability: lesson(
    "The inability form says that someone cannot do something or that something is impossible.",
    "Use -(y)ama/-(y)eme before the tense ending: gelemiyorum, yapamadı, okuyamayacak. Insert y after a vowel-final stem.",
    [["Bugün gelemiyorum.", "I cannot come today."], ["Bu kutuyu taşıyamam.", "I cannot carry this box."], ["Dün seni arayamadım.", "I could not call you yesterday."]],
  ),
  necessity: lesson(
    "The necessity mood expresses advice, need, or obligation: “should” or “must.”",
    "Add -malı/-meli to the verb stem according to two-way harmony, then nominal personal endings: gitmeliyim, çalışmalısın, beklemeliyiz.",
    [["Daha çok su içmelisin.", "You should drink more water."], ["Şimdi gitmeliyim.", "I must go now."], ["Yarın erken kalkmalıyız.", "We must get up early tomorrow."]],
  ),
  "obligation-zorunda": lesson(
    "Zorunda olmak expresses a strong or external obligation: “have to.”",
    "Use verb infinitive -mak/-mek + zorunda + personal ending or a form of olmak: gitmek zorundayım, çalışmak zorunda kaldı. Negate with zorunda değil.",
    [["Bugün çalışmak zorundayım.", "I have to work today."], ["Saat sekizde evde olmak zorundasın.", "You have to be home at eight."], ["Yarın gelmek zorunda değiliz.", "We do not have to come tomorrow."]],
  ),
  "suggestion-lets": lesson(
    "The first-person plural imperative suggests doing something together: “let's.”",
    "Add -(y)alım/-(y)elim to the verb stem by vowel harmony, inserting y after a vowel: gidelim, başlayalım, okuyalım. Hadi can introduce the suggestion.",
    [["Hadi parka gidelim.", "Let's go to the park."], ["Bir kahve içelim.", "Let's drink a coffee."], ["Derse başlayalım.", "Let's start the lesson."]],
  ),
  "basic-conditional": lesson(
    "The conditional expresses what happens if a condition is met.",
    "Add -sa/-se after an aorist or other tense form, then a personal ending: gelirsen, yağarsa, vaktimiz varsa. For nominal predicates use ise or -(y)sa/-(y)se.",
    [["Yağmur yağarsa evde kalırım.", "If it rains, I will stay home."], ["Vaktin varsa beni ara.", "If you have time, call me."], ["Erken gelirsen birlikte yeriz.", "If you come early, we will eat together."]],
  ),
  "comparisons-daha-en": lesson(
    "Daha makes a comparative and en makes a superlative.",
    "Place daha before the adjective for “more” and en before it for “most.” A comparison target commonly takes the ablative: senden daha uzun.",
    [["Bu kitap daha kolay.", "This book is easier."], ["Ankara İstanbul'dan daha küçük.", "Ankara is smaller than Istanbul."], ["Bu sınıftaki en genç öğrenci Ece.", "Ece is the youngest student in this class."]],
  ),
  "similarity-gibi": lesson(
    "Gibi expresses similarity and means “like” or “as.”",
    "Put gibi after a noun; pronouns usually take genitive forms: benim gibi, senin gibi, onun gibi. It can be followed by an adjective or verb phrase.",
    [["Pamuk gibi yumuşak.", "It is soft like cotton."], ["O da benim gibi öğrenci.", "He/She is a student like me too."], ["Çocuk kuş gibi hızlı koşuyor.", "The child runs fast like a bird."]],
  ),
  "equality-kadar": lesson(
    "Kadar expresses equal degree or extent: “as ... as.”",
    "Use comparison standard + kadar + adjective. Pronouns normally take genitive forms: benim kadar, senin kadar, onun kadar.",
    [["Senin kadar hızlı koşamam.", "I cannot run as fast as you."], ["Bu oda öteki kadar büyük.", "This room is as big as the other one."], ["Mert benim kadar uzun.", "Mert is as tall as me."]],
  ),
  "comparisons-ablative": lesson(
    "The ablative marks the standard in a comparison and means “than.”",
    "Add -dan/-den/-tan/-ten to the person or thing being compared against, usually with daha + adjective: benden daha genç.",
    [["Ayşe benden daha genç.", "Ayşe is younger than me."], ["Tren otobüsten daha hızlı.", "The train is faster than the bus."], ["Bugün dünden daha sıcak.", "Today is hotter than yesterday."]],
  ),
  "intensifying-adjectives": lesson(
    "Intensified adjectives strengthen a color or quality, often meaning “very” or “completely.”",
    "Repeat the adjective's first syllable and add a linking consonant, usually p, m, r, or s: beyaz→bembeyaz, kırmızı→kıpkırmızı, temiz→tertemiz. These forms are lexical and should be learned individually.",
    [["Üzerinde bembeyaz bir gömlek var.", "He/She is wearing a pure white shirt."], ["Bahçe yemyeşil.", "The garden is lush green."], ["Oda tertemiz.", "The room is spotless."]],
  ),
  "diminutive-adjectives": lesson(
    "Diminutive forms make a quality smaller, softer, or affectionate, such as “tiny” or “a little.”",
    "Add -cık/-cik/-cuk/-cük by four-way harmony, with consonant changes in some fixed forms: küçük→küçücük, sıcak→sıcacık, az→azıcık.",
    [["Küçücük bir evde yaşıyorlar.", "They live in a tiny house."], ["Oda sıcacık.", "The room is nice and warm."], ["Azıcık su istiyorum.", "I want a little water."]],
  ),
  "reflexive-pronouns": lesson(
    "Kendi refers back to the subject and means “self” or emphasizes that someone did something personally.",
    "Add possessive endings: kendim, kendin, kendisi, kendimiz, kendiniz, kendileri. Case suffixes can follow: kendime, kendini, kendimizden.",
    [["Bu yemeği kendim yaptım.", "I made this food myself."], ["Kendine dikkat et.", "Take care of yourself."], ["Çocuklar kendileri giyindi.", "The children got dressed themselves."]],
  ),
  "indefinite-pronouns": lesson(
    "Indefinite pronouns refer to non-specific people or things: everyone, someone, nobody, or something.",
    "Common forms include herkes, biri/birisi, bir şey, kimse, and hiçbir şey. Kimse and hiçbir şey normally require a negative verb when they mean “nobody/nothing.”",
    [["Herkes seni bekliyor.", "Everyone is waiting for you."], ["Kapıda biri var.", "There is someone at the door."], ["Kimse cevap vermedi.", "Nobody answered."]],
  ),
  infinitives: lesson(
    "The infinitive is the dictionary form of a verb and means “to do” something.",
    "Add -mak after a back vowel or -mek after a front vowel: yapmak, gelmek. It often follows verbs such as istemek and can take case suffixes after dropping k: yüzmeye.",
    [["Türkçe öğrenmek istiyorum.", "I want to learn Turkish."], ["Her sabah yürümek sağlıklı.", "Walking every morning is healthy."], ["Erken yatmak istiyorum.", "I want to go to bed early."]],
  ),
  "verbal-nouns": lesson(
    "The suffix -ma/-me turns an action into a noun: “doing” or “the act of doing.”",
    "Add -ma/-me to the stem, then noun suffixes as needed: yüzme, yüzmeyi, yüzmeye. Do not confuse this noun with the negative suffix; context and following endings show the difference.",
    [["Kitap okumayı seviyorum.", "I like reading books."], ["Burada yüzmek yasak.", "Swimming is forbidden here."], ["Erken kalkmaya alıştım.", "I got used to getting up early."]],
  ),
  "verbal-nouns-possessive": lesson(
    "A possessed verbal noun names an action performed by a particular person, such as “my leaving” or “your coming.”",
    "Use stem + -ma/-me + possessive ending, then any required case: gelmem, gelmen, gelmesi; gelmeni (your coming, accusative), gitmeme (my going, dative).",
    [["Gelmeni istiyorum.", "I want you to come."], ["Annem erken yatmamı söyledi.", "My mother told me to go to bed early."], ["Onun burada çalışması iyi.", "It is good that he/she works here."]],
  ),
  "purpose-mak-icin": lesson(
    "This construction states the purpose of an action: “in order to.”",
    "Use verb stem + -mak/-mek + için. When the subjects differ, Turkish often uses a possessed verbal noun instead: gelmen için.",
    [["Türkçe öğrenmek için İstanbul'a geldim.", "I came to Istanbul to learn Turkish."], ["Ekmek almak için markete gidiyorum.", "I am going to the market to buy bread."], ["Seni görmek için buradayım.", "I am here to see you."]],
  ),
  "before-doing": lesson(
    "This construction says that one action happens before another.",
    "Use verb stem + -madan/-meden önce. The -ma/-me follows vowel harmony, and the subject is understood from context: çıkmadan önce, yemeden önce.",
    [["Yemeden önce ellerimi yıkarım.", "I wash my hands before eating."], ["Evden çıkmadan önce kapıyı kilitledim.", "I locked the door before leaving home."], ["Uyumadan önce kitap okuyorum.", "I read a book before sleeping."]],
  ),
  "after-doing": lesson(
    "This construction shows that one finished action happens before another action.",
    "Use verb stem + past -dı/-di/-du/-dü (or -tı/-ti/-tu/-tü after a voiceless consonant) + -k + -tan/-ten + sonra, producing -dıktan/-dikten/-duktan/-dükten sonra: gel→geldikten sonra, yap→yaptıktan sonra, anla→anladıktan sonra.",
    [["Eve geldikten sonra yemek yaptım.", "After I came home, I cooked dinner."], ["Ödevimi yaptıktan sonra dışarı çıktım.", "After doing my homework, I went outside."], ["Soruyu anladıktan sonra cevap verdim.", "After understanding the question, I answered."], ["Kahvaltı ettikten sonra işe gidiyorum.", "After having breakfast, I go to work."], ["Film bittikten sonra eve döndük.", "After the film ended, we returned home."]],
  ),
  "while-doing": lesson(
    "The suffix -ken shows that two actions or states happen at the same time: “while.”",
    "Add -ken to a tense or predicate form: çalışırken, giderken, çocukken. It does not change for vowel harmony, and personal meaning comes from the main clause or context.",
    [["Çalışırken müzik dinliyorum.", "I listen to music while working."], ["Eve giderken ekmek aldım.", "I bought bread while going home."], ["Çocukken Ankara'da yaşadım.", "I lived in Ankara when I was a child."]],
  ),
  "by-doing": lesson(
    "This construction describes the manner of an action: “by doing” or “while doing.”",
    "Add -(y)arak after a back vowel or -(y)erek after a front vowel, inserting y after vowel-final stems: koşarak, gülerek, okuyarak.",
    [["Okula yürüyerek gidiyorum.", "I go to school by walking."], ["Gülerek cevap verdi.", "He/She answered with a smile."], ["Türkçe konuşarak pratik yapıyoruz.", "We practice by speaking Turkish."]],
  ),
  "without-doing": lesson(
    "This construction says that one action happens without another action taking place.",
    "Add -madan after a back vowel or -meden after a front vowel directly to the verb stem: bakmadan, yemeden. Unlike “before doing,” it is not followed by önce.",
    [["Kahvaltı yapmadan evden çıktım.", "I left home without having breakfast."], ["Bana bakmadan konuştu.", "He/She spoke without looking at me."], ["Hiç durmadan koştu.", "He/She ran without stopping."]],
  ),
  "basic-participles": lesson(
    "The participle -an/-en turns a verb into a description of the person or thing doing the action.",
    "Add -(y)an after a back vowel or -(y)en after a front vowel; insert y after a vowel: gelen adam, çalışan kadın, uyuyan çocuk. It comes before the noun it describes.",
    [["Kapıda bekleyen adam babam.", "The man waiting at the door is my father."], ["Koşan çocuk çok hızlı.", "The child who is running is very fast."], ["Masada duran kitap benim.", "The book lying on the table is mine."]],
  ),
  "reciprocal-verbs": lesson(
    "Reciprocal verbs show that people do an action to each other.",
    "Many lexical reciprocal verbs contain -ış/-iş/-uş/-üş (or -ş after a vowel), followed by normal tense endings: görüşmek, yazışmak, bakışmak. Not every verb can freely take this suffix.",
    [["Her hafta arkadaşlarımla görüşüyorum.", "I meet my friends every week."], ["Biz sık sık mesajlaşıyoruz.", "We often message each other."], ["İki çocuk bir süre bakıştı.", "The two children looked at each other for a while."]],
  ),
  "reflexive-verbs": lesson(
    "Reflexive verbs show that the subject performs an action on themselves.",
    "Common lexical verbs use -ın/-in/-un/-ün or -n after some stems: yıkanmak, giyinmek, taranmak. Conjugate the resulting verb normally; forms should be learned with each verb.",
    [["Her sabah hızlıca giyiniyorum.", "I get dressed quickly every morning."], ["Çocuk banyoda yıkandı.", "The child washed in the bathroom."], ["Ayşe aynanın önünde taranıyor.", "Ayşe is combing her hair in front of the mirror."]],
  ),
  "time-expressions-a2": lesson(
    "These expressions relate events in time using before, after, since, and throughout.",
    "Use önce/sonra after a time amount or action phrase, -dan/-den beri for “since,” and boyunca after a duration for “throughout/for.” Case endings depend on the expression.",
    [["İki saat önce eve geldim.", "I came home two hours ago."], ["Dersten sonra kahve içtik.", "We drank coffee after class."], ["Bütün gün boyunca çalıştım.", "I worked throughout the whole day."]],
  ),
  "duration-dir": lesson(
    "The suffix -dır/-dir expresses how long an ongoing situation has continued: “for.”",
    "Add -dır/-dir/-dur/-dür to a time expression, using -tır/-tir/-tur/-tür after a voiceless consonant, then use a present-state or ongoing verb: üç yıldır yaşıyorum.",
    [["Üç yıldır Türkçe öğreniyorum.", "I have been learning Turkish for three years."], ["İki saattir seni bekliyorum.", "I have been waiting for you for two hours."], ["Bir haftadır hastayım.", "I have been ill for a week."]],
  ),
  "since-beri": lesson(
    "The expression -dan/-den beri marks the starting point of an action or state that continues until now.",
    "Add ablative -dan/-den/-tan/-ten to the starting time, then beri: sabahtan beri, pazartesiden beri. Use it with an ongoing present expression.",
    [["Sabahtan beri çalışıyorum.", "I have been working since morning."], ["Pazartesiden beri yağmur yağıyor.", "It has been raining since Monday."], ["Geçen yıldan beri burada yaşıyoruz.", "We have lived here since last year."]],
  ),
  "until-kadar": lesson(
    "The expression -(y)a/-(y)e kadar marks an endpoint in time or space: “until” or “as far as.”",
    "Put the endpoint in the dative with -a/-e, inserting y after a vowel, then add kadar: akşama kadar, eve kadar.",
    [["Akşama kadar çalışacağım.", "I will work until evening."], ["Saat beşe kadar buradayım.", "I am here until five."], ["Okula kadar yürüdük.", "We walked as far as the school."]],
  ),
  "cause-reason": lesson(
    "Cause expressions explain why something happens.",
    "Use çünkü before a separate reason clause. For “because of doing/being,” use verb + -dığı/-diği/-duğu/-düğü + possessive ending + için: hasta olduğum için, geç kaldığı için.",
    [["Evde kaldım çünkü hastaydım.", "I stayed home because I was ill."], ["Yağmur yağdığı için dışarı çıkmadık.", "We did not go outside because it was raining."], ["Geç kaldığım için özür dilerim.", "I am sorry because I am late."]],
  ),
  contrast: lesson(
    "Contrast words connect ideas that differ from or oppose each other.",
    "Use ama or fakat between clauses for “but.” Use yine de at the start of or inside the second clause for “nevertheless/still.”",
    [["Yorgunum ama çalışıyorum.", "I am tired, but I am working."], ["Hava soğuk fakat güneşli.", "The weather is cold but sunny."], ["Yağmur yağıyor; yine de dışarı çıkacağım.", "It is raining; nevertheless, I will go outside."]],
  ),
  "purpose-diye": lesson(
    "Diye can introduce an intended result: “so that” or “with the thought that.”",
    "Use a desired or negative-desired verb form before diye, followed by the main action: unutmayayım diye yazdım, görsün diye getirdim.",
    [["Unutmayayım diye not aldım.", "I took a note so that I would not forget."], ["Çocuk yesin diye çorba yaptım.", "I made soup so that the child would eat."], ["Seni göreyim diye buraya geldim.", "I came here so that I could see you."]],
  ),
  "direct-speech": lesson(
    "Direct speech repeats a person's exact words.",
    "Put the quoted words in quotation marks, then use dedi/demek; diye can link a quotation to another speech verb: “Geliyorum,” dedi or “Merhaba,” diye seslendi.",
    [["Ayşe, “Yorgunum,” dedi.", "Ayşe said, “I am tired.”"], ["Babam, “Erken gel,” dedi.", "My father said, “Come early.”"], ["Çocuk, “Teşekkür ederim,” diye cevap verdi.", "The child replied, “Thank you.”"]],
  ),
  "basic-indirect-speech": lesson(
    "This construction allows you to turn an entire action or statement into something you can know, think, hear, say, or believe.",
    "Use verb + -dığı/-diği/-duğu/-düğü (or -tığı/-tiği/-tuğu/-tüğü after a voiceless consonant) + possessive ending, then the case required by the main verb; bilmek commonly takes accusative: geldiğini biliyorum.",
    [["Onun geldiğini biliyorum.", "I know that he/she came."], ["Ayşe yarın çalışacağını söyledi.", "Ayşe said that she would work tomorrow."], ["Otobüsün geç kaldığını düşünüyorum.", "I think that the bus is late."]],
  ),
  probability: lesson(
    "Probability words show that the speaker is not certain.",
    "Use belki for “maybe,” galiba for an impression, and sanırım for “I think/probably.” They do not take suffixes and usually appear near the beginning of the clause.",
    [["Belki yarın gelirim.", "Maybe I will come tomorrow."], ["Galiba otobüsü kaçırdık.", "It seems we missed the bus."], ["Sanırım bu cevap doğru.", "I think this answer is correct."]],
  ),
  preference: lesson(
    "Preference expressions say which thing or action someone likes or chooses more.",
    "Use verbal noun -ma/-me + accusative + tercih etmek: yürümeyi tercih ederim. For “rather than doing,” use verb + -maktansa/-mektense, followed by the preferred action.",
    [["Çay içmeyi tercih ederim.", "I prefer drinking tea."], ["Otobüse binmektense yürürüm.", "I would rather walk than take the bus."], ["Evde kalmayı tercih ediyoruz.", "We prefer staying at home."]],
  ),
  "basic-passive": lesson(
    "The passive focuses on the action or the affected thing rather than the person doing it.",
    "Common passive suffixes are -ıl/-il/-ul/-ül after consonants and -n after vowel-final stems; stems ending in l often use -ın/-in/-un/-ün. Add normal tense endings afterward: yapıl-dı, ara-n-dı, al-ın-dı.",
    [["Kapı saat dokuzda açıldı.", "The door was opened at nine."], ["Bu kitap birçok okulda okunuyor.", "This book is read in many schools."], ["Yemek mutfakta hazırlandı.", "The meal was prepared in the kitchen."]],
  ),
  "basic-causative": lesson(
    "The causative says that someone makes, lets, or has another person do an action.",
    "Common suffixes are -dır/-dir/-dur/-dür (or -tır/-tir/-tur/-tür after voiceless sounds) and -t after many vowel- or l/r-ending stems. Forms are partly lexical: yazdırmak, okutmak, temizletmek.",
    [["Dün saçımı kestirdim.", "I had my hair cut yesterday."], ["Öğretmen metni öğrencilere okuttu.", "The teacher made the students read the text."], ["Babam arabayı tamir ettirdi.", "My father had the car repaired."]],
  ),
}

export function getGrammarLesson(structureId: string): GrammarLesson | null {
  const base = LESSONS[structureId]
  if (!base) return null
  return {
    ...base,
    formulation: FORMULATIONS[structureId] ?? base.formulation,
  }
}

export function getGrammarFormulation(structureId: string): string | null {
  return FORMULATIONS[structureId] ?? LESSONS[structureId]?.formulation ?? null
}
