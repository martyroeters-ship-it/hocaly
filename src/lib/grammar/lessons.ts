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
    "Use ben, sen, o, biz, siz, and onlar to say who is doing something or who you are talking about. Turkish often leaves these words out because the verb ending already tells you who the subject is.",
    "Use ben (I), sen (you, singular), o (he/she/it), biz (we), siz (you, plural or polite), and onlar (they). Turkish often omits them because the verb ending already shows the person.",
    [["Ben Türkçe öğreniyorum.", "I am learning Turkish."], ["Sen çok hızlı koşuyorsun.", "You run very fast."], ["Onlar bugün evde.", "They are at home today."]],
  ),
  "demonstrative-pronouns": lesson(
    "Use bu (this), şu (that/this one being pointed out), and o (that) to point to people or things. They can stand alone or come before a noun.",
    "Use bu for something near, şu for something being pointed out or at a middle distance, and o for something farther away. Before a noun they do not take a plural suffix: bu kitap, şu ev, o çocuk.",
    [["Bu benim kitabım.", "This is my book."], ["Şu otobüs çok kalabalık.", "That bus is very crowded."], ["O bina bir hastane.", "That building is a hospital."]],
  ),
  "nominal-sentences": lesson(
    "Use personal endings to say what someone is or what someone is like. In the present tense, Turkish usually doesn't need a separate word for \"am,\" \"is,\" or \"are.\"",
    "Add personal endings to the noun or adjective: -(y)ım/-(y)im/-(y)um/-(y)üm, -sın/-sin/-sun/-sün, no ending for o, -(y)ız/-(y)iz/-(y)uz/-(y)üz, and -sınız/-siniz/-sunuz/-sünüz. Use buffer y after a vowel.",
    [["Ben öğrenciyim. Sen yorgunsun.", "I am a student. You are tired."], ["Biz hazırız.", "We are ready."], ["Siz çok naziksiniz.", "You are very kind."]],
  ),
  "nominal-negation": lesson(
    "Use değil to say that someone or something is not a certain thing or does not have a certain quality. Add a personal ending when needed.",
    "Put değil after the noun or adjective and attach the personal ending to değil: değilim, değilsin, değil, değiliz, değilsiniz, değiller.",
    [["Ben doktor değilim.", "I am not a doctor."], ["Bu oda büyük değil.", "This room is not big."], ["Biz geç değiliz.", "We are not late."]],
  ),
  "nominal-questions": lesson(
    "Use mı, mi, mu, or mü to ask whether someone or something is a certain thing or has a certain quality. Write the question particle separately.",
    "Place mı/mi/mu/mü after the noun or adjective, following four-way vowel harmony. Write it separately, then add the personal ending: miyim, misin, mi, miyiz, misiniz.",
    [["Sen öğrenci misin?", "Are you a student?"], ["Bu çorba sıcak mı?", "Is this soup hot?"], ["Siz hazır mısınız?", "Are you ready?"]],
  ),
  "var-yok": lesson(
    "Use var to say that something exists or is available, and yok to say that it doesn't exist or isn't available.",
    "Use the item as the subject, often with a location in -da/-de: Evde süt var. For questions, add separate mı/mi/mu/mü: Süt var mı?",
    [["Evde süt var mı? Hayır, yok.", "Is there milk at home? No, there isn't."], ["Masada bir kitap var.", "There is a book on the table."], ["Evde kimse yok.", "There is nobody at home."]],
  ),
  "question-words": lesson(
    "Use words such as kim (who), ne (what), nerede (where), ne zaman (when), neden (why), and nasıl (how) to ask for specific information.",
    "Put kim, ne, nerede, ne zaman, neden/niçin, nasıl, hangi, or kaç in the position of the missing information. Do not normally add mı/mi to the same question.",
    [["Bugün ne yapıyorsun?", "What are you doing today?"], ["Bu kim?", "Who is this?"], ["Nerede çalışıyorsun?", "Where do you work?"]],
  ),
  "basic-word-order": lesson(
    "In a typical Turkish sentence, the subject comes first, followed by the object, and the verb comes last. Turkish word order can change to emphasize different information.",
    "Build the sentence as subject + time/place + object + verb. Elements can move for emphasis, but beginners should keep the conjugated verb last.",
    [["Ben her gün kitap okuyorum.", "I read a book every day."], ["Ayşe okulda Türkçe öğreniyor.", "Ayşe is learning Turkish at school."], ["Biz akşam film izledik.", "We watched a film in the evening."]],
  ),
  plural: lesson(
    "Add -lar or -ler to make most nouns plural. After a number, Turkish normally keeps the noun singular.",
    "Add -lar after a back vowel (a, ı, o, u) and -ler after a front vowel (e, i, ö, ü). After an exact number, the noun normally stays singular: üç kitap.",
    [["Üç kitabım var.", "I have three books."], ["Bahçede kediler oynuyor.", "Cats are playing in the garden."], ["Kitaplar masada.", "The books are on the table."]],
  ),
  locative: lesson(
    "Add -da, -de, -ta, or -te to say where someone or something is. It usually means \"in,\" \"at,\" or \"on.\"",
    "Add -da/-de by vowel harmony; use -ta/-te after a voiceless consonant (ç, f, h, k, p, s, ş, t). After a third-person possessive suffix, insert n: evinde.",
    [["İstanbul'da yaşıyorum.", "I live in Istanbul."], ["Anahtar çantada.", "The key is in the bag."], ["Çocuklar parkta oynuyor.", "The children are playing in the park."]],
  ),
  dative: lesson(
    "Add -(y)a or -(y)e to show movement toward somewhere or someone. It often means \"to,\" but some Turkish verbs also require this ending.",
    "Add -a after a back vowel and -e after a front vowel. Insert buffer y after a vowel (arabaya), and use n after a third-person possessive suffix (evine); stem softening may occur.",
    [["Okula gidiyorum.", "I am going to school."], ["Arkadaşıma mesaj yazdım.", "I wrote a message to my friend."], ["Arabaya bindik.", "We got into the car."]],
  ),
  ablative: lesson(
    "Add -dan, -den, -tan, or -ten to show where something comes from, where someone leaves from, or what something is compared with.",
    "Add -dan/-den by vowel harmony; use -tan/-ten after a voiceless consonant. Use buffer n after a third-person possessive suffix: evinden.",
    [["İşten geliyorum.", "I am coming from work."], ["Ankara'dan geliyorum.", "I come from Ankara."], ["Dolaptan su aldım.", "I took water from the refrigerator."]],
  ),
  accusative: lesson(
    "Use the accusative ending when the direct object is specific or identifiable. You normally don't use it for an unspecified object.",
    "Add -ı/-i/-u/-ü by four-way vowel harmony. Insert y after a vowel (arabayı), use n after a third-person possessive suffix (kitabını), and apply stem softening where needed (kitap → kitabı).",
    [["Kitabı okuyorum.", "I am reading the book."], ["Kapıyı kapatır mısın?", "Can you close the door?"], ["Onu dün gördüm.", "I saw him/her yesterday."]],
  ),
  genitive: lesson(
    "Add -(n)ın, -(n)in, -(n)un, or -(n)ün to show who something belongs to. It often works like \"'s\" in English.",
    "Add -ın/-in/-un/-ün by four-way harmony; insert n after a vowel: arabanın. The possessed noun normally also takes a possessive suffix: Ali'nin kitabı.",
    [["Ali'nin arabası.", "Ali's car."], ["Evin kapısı açık.", "The door of the house is open."], ["Ayşe'nin telefonu yeni.", "Ayşe's phone is new."]],
  ),
  "possessive-suffixes": lesson(
    "Add an ending to a noun to show who owns it or who it is connected to. The ending changes depending on whether it means my, your, his/her, our, or their.",
    "After consonants use -(ı)m/-(i)m/-(u)m/-(ü)m, -(ı)n/-(i)n/-(u)n/-(ü)n, -(s)ı/-(s)i/-(s)u/-(s)ü, -(ı)mız/-(i)miz/-(u)muz/-(ü)müz, -(ı)nız/-(i)niz/-(u)nuz/-(ü)nüz, and -ları/-leri. Vowel-final nouns use the forms without the initial vowel and s for third person.",
    [["Benim evim. Senin evin.", "My house. Your house."], ["Benim adım Elif.", "My name is Elif."], ["Bizim öğretmenimiz Ankara'da yaşıyor.", "Our teacher lives in Ankara."]],
  ),
  "possessive-constructions": lesson(
    "Combine a possessor with a possessed noun to show that something belongs to someone. Both words usually receive an ending.",
    "Mark the possessor with genitive -(n)ın/-(n)in/-(n)un/-(n)ün and the possessed noun with -(s)ı/-(s)i/-(s)u/-(s)ü or another matching possessive ending.",
    [["Arkadaşımın telefonu.", "My friend's phone."], ["Okulun kapısı kapalı.", "The school's door is closed."], ["Mert'in annesi doktor.", "Mert's mother is a doctor."]],
  ),
  "consonant-mutation": lesson(
    "Some Turkish words change their final consonant when a suffix beginning with a vowel is added. Common changes include p→b, ç→c, t→d, and k→ğ/g. Not every word follows this pattern.",
    "Common changes are p→b, ç→c, t→d, and k→ğ or g: kitap→kitabı, ağaç→ağacı, kanat→kanadı, çocuk→çocuğu. Short words and proper nouns often do not soften.",
    [["Kitap → kitabım.", "Book → my book."], ["Kitabı çantama koydum.", "I put the book in my bag."], ["Ağacın altında oturuyoruz.", "We are sitting under the tree."]],
  ),
  "vowel-harmony": lesson(
    "Turkish suffixes change their vowels to match the vowels in the word. Some suffixes have two possible forms, while others have four.",
    "Two-way A harmony chooses a after a, ı, o, u and e after e, i, ö, ü. Four-way I harmony chooses ı after a/ı, i after e/i, u after o/u, and ü after ö/ü.",
    [["Evde, okulda.", "At home, at school."], ["Çocuklar bahçede oynuyor.", "The children are playing in the garden."], ["Gözüm biraz ağrıyor.", "My eye hurts a little."]],
  ),
  "buffer-consonants": lesson(
    "Turkish sometimes inserts y, n, or s between a word and a suffix. These sounds help connect endings smoothly, especially when vowels would otherwise meet.",
    "Use y with many case and tense suffixes (arabaya), s before the third-person possessive suffix (arabası), and n after that possessive suffix or in the genitive of vowel-final words (arabasına, arabanın).",
    [["Araba → arabaya.", "Car → to the car."], ["Masaya bir tabak koydum.", "I put a plate on the table."], ["Bu Ayşe'nin arabası.", "This is Ayşe's car."]],
  ),
  "present-continuous": lesson(
    "Use -ıyor/-iyor/-uyor/-üyor to describe what someone is doing now. It can also describe ongoing activities, temporary situations, and some planned future events.",
    "Use the verb stem + -ıyor/-iyor/-uyor/-üyor + personal ending. A final a/e usually narrows before -yor (başla→başlıyor, bekle→bekliyor); de- and ye- become diyor and yiyor. Besides \"now,\" it can cover temporary situations and some near-future plans.",
    [["Şu anda tenis oynuyorum.", "I am playing tennis right now."], ["Babam yemek yapıyor.", "My father is cooking."], ["Biz Türkçe öğreniyoruz.", "We are learning Turkish."]],
  ),
  "present-continuous-negation": lesson(
    "Use the negative present continuous to say that someone isn't doing something now or that an ongoing action isn't happening.",
    "Add negative -ma/-me to the stem; before -yor it becomes -mıyor/-miyor/-muyor/-müyor, followed by the personal ending.",
    [["Şu anda çalışmıyorum.", "I am not working right now."], ["Ayşe televizyon izlemiyor.", "Ayşe is not watching television."], ["Biz sizi beklemiyoruz.", "We are not waiting for you."]],
  ),
  "present-continuous-questions": lesson(
    "Use the present continuous with mı/mi/mu/mü to ask whether someone is doing something. The question particle is written separately.",
    "Use the affirmative -ıyor/-iyor/-uyor/-üyor form, then the separate question particle mu/mü and attach the personal ending to the particle: geliyor musun, okuyor muyuz?",
    [["Ne yapıyorsun? Çalışıyor musun?", "What are you doing? Are you working?"], ["Beni dinliyor musun?", "Are you listening to me?"], ["Otobüs geliyor mu?", "Is the bus coming?"]],
  ),
  "simple-past": lesson(
    "Use -dı/-di/-du/-dü and their -t forms to talk about completed past actions. It commonly expresses events you experienced or present as definite facts.",
    "Add -dı/-di/-du/-dü by four-way harmony, or -tı/-ti/-tu/-tü after a voiceless consonant, then the personal ending: geldim, baktın, okuduk.",
    [["Dün tenis oynadım.", "I played tennis yesterday."], ["Mert bize geldi.", "Mert came to us."], ["Hafta sonu müzeyi gezdik.", "We visited the museum at the weekend."]],
  ),
  "simple-past-negation": lesson(
    "Add -ma/-me before the past tense ending to say that something didn't happen.",
    "Add -ma/-me to the verb stem, then past -dı/-di and the personal ending. Because the negative suffix ends in a vowel, the past consonant is d: gelmedim, yapmadık.",
    [["Dün çalışmadım.", "I didn't work yesterday."], ["O kahvaltı yapmadı.", "He/She did not have breakfast."], ["Biz filmi izlemedik.", "We did not watch the film."]],
  ),
  "simple-past-questions": lesson(
    "Use mı/mi/mu/mü with the past tense to ask whether something happened. The question particle is written separately.",
    "Use the past form + separate mı/mi/mu/mü; personal endings usually stay on the past verb: geldin mi, okudunuz mu, yaptı mı?",
    [["Dün geldin mi?", "Did you come yesterday?"], ["Dün beni aradın mı?", "Did you call me yesterday?"], ["Otobüs geldi mi?", "Did the bus arrive?"]],
  ),
  imperative: lesson(
    "Use the imperative to tell someone to do something, give instructions, or make requests. The form changes depending on who you are addressing.",
    "Use the bare stem for informal singular commands (gel). Add -(y)ın/-(y)in/-(y)un/-(y)ün for plural or polite commands (gelin, okuyun), and -sın/-sin/-sun/-sün for third person.",
    [["Gel! / Gelin!", "Come! / Come! (plural or polite)"], ["Lütfen buraya gel.", "Please come here."], ["Kapıyı kapatın.", "Close the door, please."]],
  ),
  "basic-verb-negation": lesson(
    "Add -ma or -me to a verb stem to make it negative. Other tense endings can then follow it. The same negative stem is also used in commands such as \"don't go.\"",
    "Add -ma after a back vowel or -me after a front vowel before tense endings. For an informal negative command, use stem + -ma/-me: yapma, gitme.",
    [["Gitme!", "Don't go!"], ["Burada koşma!", "Do not run here!"], ["Geç kalmayın.", "Do not be late."]],
  ),
  "auxiliary-verbs": lesson(
    "Some Turkish actions are expressed by combining a noun or adjective with etmek or olmak. Learn these combinations as complete expressions because their meanings are not always obvious from the individual words.",
    "Use noun/adjective + etmek for doing or causing (yardım etmek) and + olmak for becoming or being (hasta olmak). Conjugate etmek or olmak; some compounds show sound changes, such as hissetmek.",
    [["Yardım etmek istiyorum.", "I want to help."], ["Arkadaşıma yardım ettim.", "I helped my friend."], ["Kardeşim hasta oldu.", "My sibling became ill."]],
  ),
  adjectives: lesson(
    "Adjectives describe what someone or something is like. In Turkish, they normally come before the noun they describe.",
    "Use adjective + noun, often with bir: güzel bir ev. Adjectives do not agree with the noun in number or case; when used as predicates, they take nominal personal endings.",
    [["Güzel bir ev.", "A beautiful house."], ["Kırmızı bir elbise aldım.", "I bought a red dress."], ["Hava bugün sıcak.", "The weather is hot today."]],
  ),
  "adverbs-frequency": lesson(
    "Use expressions such as her zaman (always), genellikle (usually), bazen (sometimes), and hiç (never, in negative sentences) to describe how often something happens.",
    "Place her zaman, genellikle, sık sık, bazen, nadiren, or hiç before the verb or near the time phrase. Hiç normally appears with a negative verb when it means “never.”",
    [["Genellikle sabahları tenis oynarım.", "I usually play tennis in the mornings."], ["Her zaman erken kalkarım.", "I always get up early."], ["Hiç kahve içmem.", "I never drink coffee."]],
  ),
  "numbers-ordinals": lesson(
    "Use ordinary numbers to count things and ordinal numbers to describe their position in an order. Ordinal numbers usually use an ending such as -ıncı/-inci/-uncu/-üncü.",
    "Add -(ı)ncı/-(i)nci/-(u)ncu/-(ü)ncü by four-way harmony. After a vowel use -ncı/-nci/-ncu/-ncü: iki→ikinci, altı→altıncı.",
    [["Birinci gün.", "The first day."], ["Birinci katta oturuyorum.", "I live on the first floor."], ["Otobüs üçüncü durakta durdu.", "The bus stopped at the third stop."]],
  ),
  "time-expressions-a1": lesson(
    "Learn how to talk about days, months, dates, and clock times. Turkish uses different endings when saying what time it is and when something happens.",
    "Use saat + number; add locative -da/-de/-ta/-te for “at” (saat üçte). Days can stand alone or use günü, and months take the locative for “in”: temmuzda.",
    [["Saat üçte buluşalım.", "Let's meet at three o'clock."], ["Ders saat dokuzda başlıyor.", "The lesson starts at nine."], ["Pazartesi günü çalışıyorum.", "I work on Monday."]],
  ),
  "basic-conjunctions": lesson(
    "Use words such as ve (and), ama (but), çünkü (because), and veya (or) to connect ideas and explain relationships between them.",
    "Use ve for “and,” ama/fakat for “but,” veya/ya da for “or,” and çünkü before the reason clause. They are separate words and take no suffix.",
    [["Gelmek istiyorum ama çalışmam lazım.", "I want to come, but I have to work."], ["Çay ve kahve aldım.", "I bought tea and coffee."], ["Evde kaldım çünkü hastaydım.", "I stayed home because I was ill."]],
  ),
  "basic-postpositions": lesson(
    "Use words such as ile (with) and için (for) after nouns or pronouns to express relationships between things, people, and actions. Some pronouns change form before these words.",
    "Use ile after a noun or attach -(y)la/-(y)le (arkadaşımla). Use için after a noun; personal pronouns usually take genitive forms: benim için, seninle.",
    [["Senin için geldim.", "I came for you."], ["Arkadaşımla sinemaya gittim.", "I went to the cinema with my friend."], ["Bu hediye senin için.", "This gift is for you."]],
  ),
  "basic-comparison": lesson(
    "Use daha to say that something has more of a quality, and en to say that something has the most of a quality.",
    "Put daha before an adjective for a comparative and en before an adjective for a superlative. The comparison standard can be omitted when it is clear.",
    [["Bu daha güzel. O en güzel.", "This is more beautiful. That is the most beautiful."], ["Bu çanta daha ucuz.", "This bag is cheaper."], ["Ece sınıfın en uzun öğrencisi.", "Ece is the tallest student in the class."]],
  ),
  "existence-possession": lesson(
    "Turkish often expresses \"have\" and \"don't have\" using a possessed noun followed by var or yok. The possessive ending tells you who has the thing.",
    "Use possessor in the genitive + noun with a possessive suffix + var/yok: benim kitabım var, onun arabası yok. Ask with var mı/yok mu.",
    [["Arabam var ama bisikletim yok.", "I have a car, but I don't have a bicycle."], ["Benim iki kardeşim var.", "I have two siblings."], ["Sizin zamanınız var mı?", "Do you have time?"]],
  ),
  future: lesson(
    "Use -acak or -ecek with personal endings to talk about what someone will do, intends to do, or expects to happen.",
    "Add -(y)acak/-(y)ecek to the stem, then personal endings. Insert y after a vowel; k often softens before a vowel-initial personal ending: yapacağım, geleceğiz.",
    [["Yarın İstanbul'a gideceğim.", "I will go to Istanbul tomorrow."], ["Yarın seni arayacağım.", "I will call you tomorrow."], ["Hafta sonu yağmur yağacak.", "It will rain at the weekend."]],
  ),
  "future-negation": lesson(
    "Add -ma/-me before the future ending to say that something will not happen.",
    "Add negative -ma/-me + -(y)acak/-(y)ecek + personal ending: gelmeyeceğim, yapmayacaklar. The buffer y connects the two vowel-initial parts.",
    [["Yarın çalışmayacağım.", "I won't work tomorrow."], ["O toplantıya gelmeyecek.", "He/She will not come to the meeting."], ["Bu akşam dışarı çıkmayacağız.", "We will not go out this evening."]],
  ),
  "future-questions": lesson(
    "Use the future tense with mı/mi/mu/mü to ask whether something will happen or whether someone plans to do something.",
    "Use the future stem + separate mı/mi; attach personal endings to the question particle for first and second persons: gelecek misin, yapacak mıyız? Third person is gelecek mi?",
    [["Yarın gelecek misin?", "Will you come tomorrow?"], ["Yağmur yağacak mı?", "Will it rain?"], ["Bu yaz tatile gidecek misiniz?", "Will you go on holiday this summer?"]],
  ),
  aorist: lesson(
    "Use the aorist to talk about habits, routines, general facts, and things that normally happen. It can also express willingness or offers. The verb ending depends on the verb stem, and some common verbs have irregular forms.",
    "Use -r after vowel-final stems; many one-syllable consonant-final stems take -ar/-er, while many longer stems take -ır/-ir/-ur/-ür. Add personal endings. Some common verbs are irregular (gel→gelir, al→alır). Unlike the present continuous (oynuyorum = now/current), the aorist (oynarım) focuses on habit and general truth.",
    [["Her sabah kahve içerim.", "I drink coffee every morning."], ["Su yüz derecede kaynar.", "Water boils at one hundred degrees."], ["Babam akşamları kitap okur.", "My father reads books in the evenings."]],
  ),
  "aorist-negation": lesson(
    "Use the negative aorist to describe things you normally don't do, general negative facts, or unwillingness. The first-person forms are special: -mam/-mem and -mayız/-meyiz.",
    "Use stem + -maz/-mez for most persons, then personal endings: yapmazsın, gelmezler. First-person forms are -mam/-mem and -mayız/-meyiz: gelmem, yapmayız.",
    [["Genellikle kahve içmem.", "I usually don't drink coffee."], ["O pazar günleri çalışmaz.", "He/She does not work on Sundays."], ["Biz geç kalmayız.", "We are not usually late."]],
  ),
  "aorist-questions": lesson(
    "Use the aorist with mı/mi/mu/mü to ask about habits, routines, or willingness. The question particle is written separately.",
    "Use the affirmative aorist + separate mı/mi/mu/mü, with personal endings on the particle: gelir misin, okur musunuz? Third person is gelir mi?",
    [["Futbol oynar mısın?", "Do you play football?"], ["Her gün yürür müsün?", "Do you walk every day?"], ["Bana yardım eder misiniz?", "Would you help me?"]],
  ),
  "reported-past": lesson(
    "Use -mış/-miş/-muş/-müş when talking about something you heard from someone else, discovered afterward, or understood from evidence. It can also express surprise.",
    "Add -mış/-miş/-muş/-müş by four-way harmony, then personal endings: gelmişim, yapmışsın, uyumuş. It contrasts with directly witnessed -dı, and it is not the same as -DIK/-AcAK noun clauses used for \"I know/say that…\".",
    [["Aaa, ekmek almışsın!", "Oh, you've bought bread!"], ["Ali dün buraya gelmiş.", "Apparently Ali came here yesterday."], ["Gece çok kar yağmış.", "It seems that it snowed a lot at night."]],
  ),
  "reported-past-negation": lesson(
    "Use the negative reported past when you learn or discover that something didn't happen.",
    "Add negative -ma/-me + -mış/-miş + personal ending: gelmemiş, yapmamışsınız. Harmony is determined by the negative suffix.",
    [["Meğer dün gelmemiş.", "Apparently, he/she didn't come yesterday."], ["Ayşe bugün okula gelmemiş.", "Apparently Ayşe did not come to school today."], ["Onlar filmi izlememişler.", "I hear they did not watch the film."]],
  ),
  "reported-past-questions": lesson(
    "Use the reported past with mı/mi/mu/mü to ask about something someone reportedly did or something that may have happened without your direct knowledge.",
    "Use reported past -mış/-miş/-muş/-müş + separate mı/mi/mu/mü. Personal endings remain on the reported-past form: gelmiş mi, okumuş musun?",
    [["Ali gelmiş mi?", "Has Ali come? / Did Ali come, apparently?"], ["Bu yemeği daha önce yemiş misin?", "Have you eaten this dish before?"], ["Onlar taşınmışlar mı?", "Have they moved, from what you heard?"]],
  ),
  ability: lesson(
    "Add -(y)abil/-(y)ebil to a verb to say that someone can do something or that something is possible. The ending is followed by the appropriate tense and personal endings.",
    "Add -(y)abil/-(y)ebil to the stem, then a tense and personal ending. Insert y after a vowel: yapabilirim, okuyabilir, gelebiliriz.",
    [["Türkçe konuşabilirim.", "I can speak Turkish."], ["Burada oturabilir miyiz?", "Can we sit here?"], ["Yarın yağmur yağabilir.", "It may rain tomorrow."]],
  ),
  inability: lesson(
    "Use -(y)ama/-(y)eme with the appropriate tense ending to say that someone cannot do something or that an action is not possible.",
    "Use -(y)ama/-(y)eme before the tense ending: gelemiyorum, yapamadı, okuyamayacak. Insert y after a vowel-final stem.",
    [["Bugün gelemem.", "I can't come today."], ["Bu kutuyu taşıyamam.", "I cannot carry this box."], ["Dün seni arayamadım.", "I could not call you yesterday."]],
  ),
  necessity: lesson(
    "Use -malı or -meli to say that someone should or must do something. Depending on context, it can express advice, a personal need, or an obligation.",
    "Add -malı/-meli to the verb stem according to two-way harmony, then nominal personal endings: gitmeliyim, çalışmalısın, beklemeliyiz.",
    [["Daha fazla Türkçe çalışmalıyım.", "I should study Turkish more."], ["Daha çok su içmelisin.", "You should drink more water."], ["Yarın erken kalkmalıyız.", "We must get up early tomorrow."]],
  ),
  "obligation-zorunda": lesson(
    "Use zorunda olmak to express a strong obligation or something that someone has no real choice about doing. The verb before zorunda takes a -mak/-mek form.",
    "Use verb infinitive -mak/-mek + zorunda + personal ending or a form of olmak: gitmek zorundayım, çalışmak zorunda kaldı. Negate with zorunda değil.",
    [["Yarın çalışmak zorundayım.", "I have to work tomorrow."], ["Saat sekizde evde olmak zorundasın.", "You have to be home at eight."], ["Yarın gelmek zorunda değiliz.", "We do not have to come tomorrow."]],
  ),
  "suggestion-lets": lesson(
    "Use -(y)alım or -(y)elim to suggest doing something together. It means \"let's.\"",
    "Add -(y)alım/-(y)elim to the verb stem by vowel harmony, inserting y after a vowel: gidelim, başlayalım, okuyalım. Hadi can introduce the suggestion.",
    [["Bir kahve içelim.", "Let's have a coffee."], ["Hadi parka gidelim.", "Let's go to the park."], ["Derse başlayalım.", "Let's start the lesson."]],
  ),
  "basic-conditional": lesson(
    "Use -sa or -se to express a condition. It often means \"if.\" The conditional ending combines with personal endings and can also follow other tense forms.",
    "Add -sa/-se after an aorist or other tense form, then a personal ending: gelirsen, yağarsa, vaktimiz varsa. For nominal predicates use ise or -(y)sa/-(y)se.",
    [["Vaktin varsa buluşalım.", "If you have time, let's meet."], ["Yağmur yağarsa evde kalırım.", "If it rains, I will stay home."], ["Erken gelirsen birlikte yeriz.", "If you come early, we will eat together."]],
  ),
  "comparisons-daha-en": lesson(
    "Use daha to compare two things and en to describe the highest degree of a quality. When comparing two things, the thing you compare against often takes -dan/-den.",
    "Place daha before the adjective for “more” and en before it for “most.” A comparison target commonly takes the ablative: senden daha uzun.",
    [["Bu kitap daha kolay. Bu en kolay kitap.", "This book is easier. This is the easiest book."], ["Ankara İstanbul'dan daha küçük.", "Ankara is smaller than Istanbul."], ["Bu sınıftaki en genç öğrenci Ece.", "Ece is the youngest student in this class."]],
  ),
  "similarity-gibi": lesson(
    "Use gibi to say that someone or something is similar to something else. It means \"like\" or \"as.\" It follows the word or expression being compared.",
    "Put gibi after a noun; pronouns usually take genitive forms: benim gibi, senin gibi, onun gibi. It can be followed by an adjective or verb phrase.",
    [["Türk gibi konuşuyorsun.", "You speak like a Turk."], ["Pamuk gibi yumuşak.", "It is soft like cotton."], ["O da benim gibi öğrenci.", "He/She is a student like me too."]],
  ),
  "equality-kadar": lesson(
    "Use kadar to compare how much of a quality two things have. It can also describe an amount, degree, distance, or limit.",
    "Use comparison standard + kadar + adjective. Pronouns normally take genitive forms: benim kadar, senin kadar, onun kadar.",
    [["Senin kadar hızlı koşamam.", "I can't run as fast as you."], ["Bu oda öteki kadar büyük.", "This room is as big as the other one."], ["Mert benim kadar uzun.", "Mert is as tall as me."]],
  ),
  "comparisons-ablative": lesson(
    "Add -dan or -den (or -tan/-ten) to the thing you're comparing against. In comparative sentences, this ending means \"than.\"",
    "Add -dan/-den/-tan/-ten to the person or thing being compared against, usually with daha + adjective: benden daha genç.",
    [["Ben senden daha uzunum.", "I am taller than you."], ["Ayşe benden daha genç.", "Ayşe is younger than me."], ["Tren otobüsten daha hızlı.", "The train is faster than the bus."]],
  ),
  "intensifying-adjectives": lesson(
    "Some Turkish adjectives have special intensified forms that make their meaning stronger. These often mean \"very,\" \"completely,\" or \"extremely.\" The forms are partly irregular and should be learned individually.",
    "Repeat the adjective's first syllable and add a linking consonant, usually p, m, r, or s: beyaz→bembeyaz, kırmızı→kıpkırmızı, temiz→tertemiz. These forms are lexical and should be learned individually.",
    [["Bembeyaz bir gömlek.", "A completely white shirt."], ["Bahçe yemyeşil.", "The garden is lush green."], ["Oda tertemiz.", "The room is spotless."]],
  ),
  "diminutive-adjectives": lesson(
    "Diminutive endings such as -cık/-cik/-cuk/-cük can make a word sound smaller, more affectionate, or softer. Some adjectives also use other endings to mean \"a little.\"",
    "Add -cık/-cik/-cuk/-cük by four-way harmony, with consonant changes in some fixed forms: küçük→küçücük, sıcak→sıcacık, az→azıcık.",
    [["Küçücük bir ev.", "A tiny house."], ["Oda sıcacık.", "The room is nice and warm."], ["Azıcık su istiyorum.", "I want a little water."]],
  ),
  "reflexive-pronouns": lesson(
    "Use kendi and its personal forms to refer back to someone already mentioned. They can mean \"myself,\" \"yourself,\" \"himself,\" and so on, or emphasize that someone did something personally.",
    "Add possessive endings: kendim, kendin, kendisi, kendimiz, kendiniz, kendileri. Case suffixes can follow: kendime, kendini, kendimizden.",
    [["Bunu kendim yaptım.", "I did this myself."], ["Kendine dikkat et.", "Take care of yourself."], ["Çocuklar kendileri giyindi.", "The children got dressed themselves."]],
  ),
  "indefinite-pronouns": lesson(
    "Use words such as herkes (everyone), biri (someone), bir şey (something), and kimse (anyone/nobody, depending on the sentence) when you don't identify a particular person or thing.",
    "Common forms include herkes, biri/birisi, bir şey, kimse, and hiçbir şey. Kimse and hiçbir şey normally require a negative verb when they mean “nobody/nothing.”",
    [["Herkes geldi ama Ali gelmedi.", "Everyone came, but Ali didn't."], ["Kapıda biri var.", "There is someone at the door."], ["Kimse cevap vermedi.", "Nobody answered."]],
  ),
  infinitives: lesson(
    "Add -mak or -mek to a verb stem to create its dictionary form. Infinitives can also be used in sentences, especially with expressions of wanting, needing, or having to do something.",
    "Add -mak after a back vowel or -mek after a front vowel: yapmak, gelmek. It often follows verbs such as istemek and can take case suffixes after dropping k: yüzmeye. This is the dictionary form; for \"your going / my coming,\" use -ma/-me with a possessive ending instead.",
    [["Türkçe öğrenmek istiyorum.", "I want to learn Turkish."], ["Her sabah yürümek sağlıklı.", "Walking every morning is healthy."], ["Erken yatmak istiyorum.", "I want to go to bed early."]],
  ),
  "verbal-nouns": lesson(
    "Add -ma or -me to a verb stem to turn an action into a noun-like expression. This lets you talk about an activity itself, such as \"reading,\" \"going,\" or \"learning.\"",
    "Add -ma/-me to the stem, then noun suffixes as needed: yüzme, yüzmeyi, yüzmeye. Do not confuse this noun with the negative suffix; context and following endings show the difference. Unlike -mak/-mek (gitmek istiyorum = I want to go), possessed -ma/-me lets you say gitmeni istiyorum = I want you to go.",
    [["Kitap okumayı seviyorum.", "I like reading books."], ["Burada yüzmek yasak.", "Swimming is forbidden here."], ["Erken kalkmaya alıştım.", "I got used to getting up early."]],
  ),
  "verbal-nouns-possessive": lesson(
    "Add a possessive ending to a verbal noun to show who performs the action. This lets you express ideas such as \"my coming,\" \"your leaving,\" or \"his working.\"",
    "Use stem + -ma/-me + possessive ending, then any required case: gelmem, gelmen, gelmesi; gelmeni (your coming, accusative), gitmeme (my going, dative).",
    [["Senin gelmeni istiyorum.", "I want you to come."], ["Annem erken yatmamı söyledi.", "My mother told me to go to bed early."], ["Onun burada çalışması iyi.", "It is good that he/she works here."]],
  ),
  "purpose-mak-icin": lesson(
    "Use -mak/-mek için to explain why someone does something. It means \"in order to\" or \"to.\" When the action has a different subject, another construction may be needed.",
    "Use verb stem + -mak/-mek + için. When the subjects differ, Turkish often uses a possessed verbal noun instead: gelmen için.",
    [["Türkçe öğrenmek için çalışıyorum.", "I study to learn Turkish."], ["Ekmek almak için markete gidiyorum.", "I am going to the market to buy bread."], ["Seni görmek için buradayım.", "I am here to see you."]],
  ),
  "before-doing": lesson(
    "Use -madan/-meden önce to say that something happens before another action. Although -madan/-meden can also mean \"without doing,\" adding önce makes the meaning \"before doing.\"",
    "Use verb stem + -madan/-meden önce. The -ma/-me follows vowel harmony, and the subject is understood from context: çıkmadan önce, yemeden önce. Without önce, -madan/-meden means \"without doing\" (Beklemeden gittik = We left without waiting).",
    [["Evden çıkmadan önce kahvaltı yapıyorum.", "I have breakfast before leaving home."], ["Yemeden önce ellerimi yıkarım.", "I wash my hands before eating."], ["Uyumadan önce kitap okuyorum.", "I read a book before sleeping."]],
  ),
  "after-doing": lesson(
    "Use -dıktan/-dikten/-duktan/-dükten sonra, with the appropriate consonant changes, to say that one action happens after another action has finished.",
    "Use verb stem + past -dı/-di/-du/-dü (or -tı/-ti/-tu/-tü after a voiceless consonant) + -k + -tan/-ten + sonra, producing -dıktan/-dikten/-duktan/-dükten sonra: gel→geldikten sonra, yap→yaptıktan sonra, anla→anladıktan sonra.",
    [["Tenis oynadıktan sonra duş alıyorum.", "I take a shower after playing tennis."], ["Eve geldikten sonra yemek yaptım.", "After I came home, I cooked dinner."], ["Ödevimi yaptıktan sonra dışarı çıktım.", "After doing my homework, I went outside."]],
  ),
  "while-doing": lesson(
    "Use -(y)ken to say that something happens while another action or situation is happening. It can follow different verb forms or words describing a state.",
    "Add -ken to a tense or predicate form: çalışırken, giderken, çocukken. It does not change for vowel harmony, and personal meaning comes from the main clause or context.",
    [["Yemek yerken televizyon izliyorum.", "I watch television while eating."], ["Çalışırken müzik dinliyorum.", "I listen to music while working."], ["Eve giderken ekmek aldım.", "I bought bread while going home."]],
  ),
  "by-doing": lesson(
    "Use -(y)arak/-(y)erek to explain how someone does something. It often means \"by doing\" or describes two actions happening together.",
    "Add -(y)arak after a back vowel or -(y)erek after a front vowel, inserting y after vowel-final stems: koşarak, gülerek, okuyarak.",
    [["Yürüyerek işe gidiyorum.", "I go to work on foot."], ["Gülerek cevap verdi.", "He/She answered with a smile."], ["Türkçe konuşarak pratik yapıyoruz.", "We practice by speaking Turkish."]],
  ),
  "without-doing": lesson(
    "Use -madan or -meden to say that someone does one thing without doing another. Unlike \"before doing,\" this construction does not require önce.",
    "Add -madan after a back vowel or -meden after a front vowel directly to the verb stem: bakmadan, yemeden. Unlike \"before doing\" (-madan/-meden önce), this form is not followed by önce.",
    [["Beklemeden gittik.", "We left without waiting."], ["Kahvaltı yapmadan evden çıktım.", "I left home without having breakfast."], ["Bana bakmadan konuştu.", "He/She spoke without looking at me."]],
  ),
  "basic-participles": lesson(
    "Add -(y)an or -(y)en to a verb to describe a person or thing that performs an action. The resulting expression works like an adjective and normally comes before the noun.",
    "Add -(y)an after a back vowel or -(y)en after a front vowel; insert y after a vowel: gelen adam, çalışan kadın, uyuyan çocuk. It comes before the noun it describes.",
    [["Orada oturan adam benim arkadaşım.", "The man sitting there is my friend."], ["Kapıda bekleyen adam babam.", "The man waiting at the door is my father."], ["Masada duran kitap benim.", "The book lying on the table is mine."]],
  ),
  "reciprocal-verbs": lesson(
    "Some Turkish verbs use a reciprocal ending, often -(I)ş, to describe people doing something together or to each other. Not every verb can use this ending, and some verbs with this form have special meanings.",
    "Many lexical reciprocal verbs contain -ış/-iş/-uş/-üş (or -ş after a vowel), followed by normal tense endings: görüşmek, yazışmak, bakışmak. Not every verb can freely take this suffix.",
    [["Dün arkadaşlarımla görüştüm.", "I met with my friends yesterday."], ["Biz sık sık mesajlaşıyoruz.", "We often message each other."], ["İki çocuk bir süre bakıştı.", "The two children looked at each other for a while."]],
  ),
  "reflexive-verbs": lesson(
    "Some Turkish verbs have a reflexive form, often using -(I)n, that shows the subject doing something to themselves or becoming affected by an action. These forms are not always predictable, so learn common reflexive verbs individually.",
    "Common lexical verbs use -ın/-in/-un/-ün or -n after some stems: yıkanmak, giyinmek, taranmak. Conjugate the resulting verb normally; forms should be learned with each verb.",
    [["Sabah erkenden giyindim.", "I got dressed early in the morning."], ["Her sabah hızlıca giyiniyorum.", "I get dressed quickly every morning."], ["Çocuk banyoda yıkandı.", "The child washed in the bathroom."]],
  ),
  "time-expressions-a2": lesson(
    "Use expressions such as önce (before), sonra (after), beri (since), and boyunca (throughout/for) to explain when something happens and how events relate in time.",
    "Use önce/sonra after a time amount or action phrase, -dan/-den beri for “since,” and boyunca after a duration for “throughout/for.” Case endings depend on the expression.",
    [["İki saat boyunca çalıştım.", "I worked for two hours."], ["İki saat önce eve geldim.", "I came home two hours ago."], ["Dersten sonra kahve içtik.", "We drank coffee after class."]],
  ),
  "duration-dir": lesson(
    "Use time expressions such as iki gündür, üç saattir, or bir yıldır to say how long a situation has continued up to now. In these expressions, -dır/-dir and its variants attach to the duration. This is a specific use of the suffix, which also has other functions in Turkish.",
    "Add -dır/-dir/-dur/-dür to a time expression, using -tır/-tir/-tur/-tür after a voiceless consonant, then use a present-state or ongoing verb: üç yıldır yaşıyorum. This duration use is only one function of -dır/-dir; the same suffix also appears in other Turkish constructions.",
    [["İki yıldır Türkçe öğreniyorum.", "I have been learning Turkish for two years."], ["İki saattir seni bekliyorum.", "I have been waiting for you for two hours."], ["Bir haftadır hastayım.", "I have been ill for a week."]],
  ),
  "since-beri": lesson(
    "Use -dan/-den beri to say when an ongoing action or situation started. The action or situation continues up to the present or another reference point.",
    "Add ablative -dan/-den/-tan/-ten to the starting time, then beri: sabahtan beri, pazartesiden beri. Use it with an ongoing present expression.",
    [["Pazartesiden beri hastayım.", "I have been sick since Monday."], ["Sabahtan beri çalışıyorum.", "I have been working since morning."], ["Geçen yıldan beri burada yaşıyoruz.", "We have lived here since last year."]],
  ),
  "until-kadar": lesson(
    "Use -(y)a/-(y)e kadar to describe an endpoint in time or space. It means \"until,\" \"up to,\" or \"as far as.\"",
    "Put the endpoint in the dative with -a/-e, inserting y after a vowel, then add kadar: akşama kadar, eve kadar.",
    [["Saat beşe kadar çalışacağım.", "I will work until five o'clock."], ["Akşama kadar çalışacağım.", "I will work until evening."], ["Okula kadar yürüdük.", "We walked as far as the school."]],
  ),
  "cause-reason": lesson(
    "Use expressions such as çünkü (because) and -dığı/-diği için (because someone did/does something) to explain why something happens.",
    "Use çünkü before a separate reason clause. For “because of doing/being,” use verb + -dığı/-diği/-duğu/-düğü + possessive ending + için: hasta olduğum için, geç kaldığı için.",
    [["Yağmur yağdığı için evde kaldım.", "I stayed home because it was raining."], ["Evde kaldım çünkü hastaydım.", "I stayed home because I was ill."], ["Geç kaldığım için özür dilerim.", "I am sorry because I am late."]],
  ),
  contrast: lesson(
    "Use ama (but), fakat (however), and yine de (nevertheless/still) to connect ideas that contrast with each other.",
    "Use ama or fakat between clauses for “but.” Use yine de at the start of or inside the second clause for “nevertheless/still.”",
    [["Çok yorgunum ama tenis oynamak istiyorum.", "I am very tired, but I want to play tennis."], ["Hava soğuk fakat güneşli.", "The weather is cold but sunny."], ["Yağmur yağıyor; yine de dışarı çıkacağım.", "It is raining; nevertheless, I will go outside."]],
  ),
  "purpose-diye": lesson(
    "Use diye to express someone's intention, expectation, or reason for doing something. It can mean \"so that,\" \"thinking that,\" or \"because,\" depending on the sentence.",
    "Use a desired or negative-desired verb form before diye, followed by the main action: unutmayayım diye yazdım, görsün diye getirdim.",
    [["Geç kalmayayım diye erken çıktım.", "I left early so that I wouldn't be late."], ["Unutmayayım diye not aldım.", "I took a note so that I would not forget."], ["Çocuk yesin diye çorba yaptım.", "I made soup so that the child would eat."]],
  ),
  "direct-speech": lesson(
    "Use demek or diye to introduce someone's exact words. Direct speech repeats what a person actually said, rather than changing it into a reported statement.",
    "Put the quoted words in quotation marks, then use dedi/demek; diye can link a quotation to another speech verb: “Geliyorum,” dedi or “Merhaba,” diye seslendi.",
    [["Bana \"Yarın geleceğim,\" dedi.", "He/she told me, \"I will come tomorrow.\""], ["Ayşe, \"Yorgunum,\" dedi.", "Ayşe said, \"I am tired.\""], ["Babam, \"Erken gel,\" dedi.", "My father said, \"Come early.\""]],
  ),
  "basic-indirect-speech": lesson(
    "Use verb forms with -DIK or -(y)AcAK, followed by possessive and sometimes case endings, to turn an entire action or statement into something you can know, think, hear, say, or believe. In English, this often corresponds to \"that someone does/did/will do something.\" This construction is also used for indirect speech.",
    "Use verb + -dığı/-diği/-duğu/-düğü (or -tığı/-tiği/-tuğu/-tüğü after a voiceless consonant) or future -(y)acağı/-(y)eceği + possessive ending, then the case required by the main verb; bilmek commonly takes accusative: geldiğini biliyorum, çalışacağını söyledi. This is a noun-like clause construction. It is not the same as the reported past tense -miş (Gelmiş = Apparently he/she came).",
    [["Onun geldiğini biliyorum.", "I know that he/she came."], ["Ayşe yarın çalışacağını söyledi.", "Ayşe said that she would work tomorrow."], ["Otobüsün geç kaldığını düşünüyorum.", "I think that the bus is late."]],
  ),
  probability: lesson(
    "Use words such as belki (maybe), galiba (apparently/probably), and sanırım (I think/I suppose) when you're not completely certain about something.",
    "Use belki for “maybe,” galiba for an impression, and sanırım for “I think/probably.” They do not take suffixes and usually appear near the beginning of the clause.",
    [["Galiba yarın yağmur yağacak.", "I think it will probably rain tomorrow."], ["Belki yarın gelirim.", "Maybe I will come tomorrow."], ["Sanırım bu cevap doğru.", "I think this answer is correct."]],
  ),
  preference: lesson(
    "Use tercih etmek to say what you prefer. You can also use -maktansa/-mektense to compare actions and say what you'd rather do instead.",
    "Use verbal noun -ma/-me + accusative + tercih etmek: yürümeyi tercih ederim. For “rather than doing,” use verb + -maktansa/-mektense, followed by the preferred action.",
    [["Kahve içmektense çay içmeyi tercih ederim.", "I prefer drinking tea to drinking coffee."], ["Otobüse binmektense yürürüm.", "I would rather walk than take the bus."], ["Evde kalmayı tercih ediyoruz.", "We prefer staying at home."]],
  ),
  "basic-passive": lesson(
    "Use passive verb forms to focus on what happens to something rather than who performs the action. Common passive endings include -(I)l and -(I)n, depending on the verb stem. Some passive forms must be learned individually.",
    "Common passive suffixes are -ıl/-il/-ul/-ül after consonants and -n after vowel-final stems; stems ending in l often use -ın/-in/-un/-ün. Add normal tense endings afterward: yapıl-dı, ara-n-dı, al-ın-dı.",
    [["Yemek yapıldı.", "The food was prepared."], ["Kapı saat dokuzda açıldı.", "The door was opened at nine."], ["Bu kitap birçok okulda okunuyor.", "This book is read in many schools."]],
  ),
  "basic-causative": lesson(
    "Use causative verb forms when someone makes, lets, or arranges for another person to do something. Turkish has several causative endings, including -dır/-dir, -t, and -ır/-ir, depending on the verb.",
    "Common suffixes are -dır/-dir/-dur/-dür (or -tır/-tir/-tur/-tür after voiceless sounds) and -t after many vowel- or l/r-ending stems. Forms are partly lexical: yazdırmak, okutmak, temizletmek.",
    [["Saçımı kestirdim.", "I had my hair cut."], ["Öğretmen metni öğrencilere okuttu.", "The teacher made the students read the text."], ["Babam arabayı tamir ettirdi.", "My father had the car repaired."]],
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
