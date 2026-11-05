import { describe, expect, it } from "vitest"
import {
  buildFormulationChain,
  conjugate,
  englishGlossForForm,
  stripInfinitive,
} from "@/lib/grammar/conjugate"

describe("future soft-g", () => {
  const gel = stripInfinitive("gelmek")

  it("softens k→ğ before vowel-initial person endings (affirmative)", () => {
    expect(conjugate("future", gel, "1sg")).toBe("geleceğim")
    expect(conjugate("future", gel, "2sg")).toBe("geleceksin")
    expect(conjugate("future", gel, "3sg")).toBe("gelecek")
    expect(conjugate("future", gel, "1pl")).toBe("geleceğiz")
    expect(conjugate("future", gel, "2pl")).toBe("geleceksiniz")
    expect(conjugate("future", gel, "3pl")).toBe("gelecekler")
  })

  it("softens k→ğ before vowel-initial person endings (negation)", () => {
    expect(conjugate("future-negation", gel, "1sg")).toBe("gelmeyeceğim")
    expect(conjugate("future-negation", gel, "2sg")).toBe("gelmeyeceksin")
    expect(conjugate("future-negation", gel, "3sg")).toBe("gelmeyecek")
    expect(conjugate("future-negation", gel, "1pl")).toBe("gelmeyeceğiz")
    expect(conjugate("future-negation", gel, "2pl")).toBe("gelmeyeceksiniz")
    expect(conjugate("future-negation", gel, "3pl")).toBe("gelmeyecekler")
  })
})

describe("future negation paradigms", () => {
  it("yazmak keeps buffer y before -acak (yazmayacaklar, not yazmacaklar)", () => {
    const yaz = stripInfinitive("yazmak")
    expect(conjugate("future-negation", yaz, "1sg")).toBe("yazmayacağım")
    expect(conjugate("future-negation", yaz, "2sg")).toBe("yazmayacaksın")
    expect(conjugate("future-negation", yaz, "3sg")).toBe("yazmayacak")
    expect(conjugate("future-negation", yaz, "1pl")).toBe("yazmayacağız")
    expect(conjugate("future-negation", yaz, "2pl")).toBe("yazmayacaksınız")
    expect(conjugate("future-negation", yaz, "3pl")).toBe("yazmayacaklar")
    expect(conjugate("future-negation", "yaz", "3pl")).toBe("yazmayacaklar")
  })

  it("gelmek future-negation uses -meyecek + soft-g", () => {
    const gel = stripInfinitive("gelmek")
    expect(conjugate("future-negation", gel, "1sg")).toBe("gelmeyeceğim")
    expect(conjugate("future-negation", gel, "3pl")).toBe("gelmeyecekler")
  })

  it("gitmek keeps citation stem in negation (gitmeyecek, not gidmeyecek)", () => {
    // Affirmative softens git→gid; negation must keep git- even if softened stem is passed
    expect(conjugate("future", "git", "3sg")).toBe("gidecek")
    expect(conjugate("future", "gid", "3sg")).toBe("gidecek")
    expect(conjugate("future-negation", "git", "3sg")).toBe("gitmeyecek")
    expect(conjugate("future-negation", "gid", "3sg")).toBe("gitmeyecek")
    expect(conjugate("future-negation", "git", "1sg")).toBe("gitmeyeceğim")
    expect(conjugate("future-negation", "git", "3pl")).toBe("gitmeyecekler")
  })
})

describe("spot-check other tenses", () => {
  const gel = stripInfinitive("gelmek")
  const yaz = stripInfinitive("yazmak")

  it("present continuous ± negation", () => {
    expect(conjugate("present-continuous", gel, "1sg")).toBe("geliyorum")
    expect(conjugate("present-continuous", gel, "1pl")).toBe("geliyoruz")
    expect(conjugate("present-continuous-negation", gel, "1sg")).toBe("gelmiyorum")
    expect(conjugate("present-continuous-negation", yaz, "3pl")).toBe("yazmıyorlar")
  })

  it("simple past ± negation", () => {
    expect(conjugate("simple-past", gel, "1sg")).toBe("geldim")
    expect(conjugate("simple-past", gel, "1pl")).toBe("geldik")
    expect(conjugate("simple-past-negation", gel, "1sg")).toBe("gelmedim")
    expect(conjugate("simple-past-negation", yaz, "3pl")).toBe("yazmadılar")
  })

  it("aorist ± negation", () => {
    expect(conjugate("aorist", gel, "3sg")).toBe("gelir")
    expect(conjugate("aorist", yaz, "3sg")).toBe("yazar")
    expect(conjugate("aorist-negation", gel, "1sg")).toBe("gelmem")
    expect(conjugate("aorist-negation", gel, "3sg")).toBe("gelmez")
  })

  it("necessity inserts buffer y after -meli/-malı (gelmeliyim, not gelmeliim)", () => {
    expect(conjugate("necessity", gel, "1sg")).toBe("gelmeliyim")
    expect(conjugate("necessity", gel, "1pl")).toBe("gelmeliyiz")
    expect(conjugate("necessity", yaz, "1sg")).toBe("yazmalıyım")
    expect(conjugate("necessity", yaz, "1pl")).toBe("yazmalıyız")
    expect(conjugate("necessity", gel, "2sg")).toBe("gelmelisin")
    expect(conjugate("necessity", gel, "3sg")).toBe("gelmeli")
  })
})

describe("buffer y before predicative person endings", () => {
  const gel = stripInfinitive("gelmek")
  const yap = stripInfinitive("yapmak")
  const anla = stripInfinitive("anlamak")

  it("necessity: gelmeliyim / gelmeliyiz (not gelmeliim)", () => {
    expect(conjugate("necessity", gel, "1sg")).toBe("gelmeliyim")
    expect(conjugate("necessity", gel, "2sg")).toBe("gelmelisin")
    expect(conjugate("necessity", gel, "3sg")).toBe("gelmeli")
    expect(conjugate("necessity", gel, "1pl")).toBe("gelmeliyiz")
    expect(conjugate("necessity", gel, "2pl")).toBe("gelmelisiniz")
    expect(conjugate("necessity", gel, "3pl")).toBe("gelmeliler")
  })

  it("necessity: yapmak paradigm with buffer y", () => {
    expect(conjugate("necessity", yap, "1sg")).toBe("yapmalıyım")
    expect(conjugate("necessity", yap, "2sg")).toBe("yapmalısın")
    expect(conjugate("necessity", yap, "3sg")).toBe("yapmalı")
    expect(conjugate("necessity", yap, "1pl")).toBe("yapmalıyız")
    expect(conjugate("necessity", yap, "2pl")).toBe("yapmalısınız")
    expect(conjugate("necessity", yap, "3pl")).toBe("yapmalılar")
  })

  it("necessity: anlamak paradigm with buffer y", () => {
    expect(conjugate("necessity", anla, "1sg")).toBe("anlamalıyım")
    expect(conjugate("necessity", anla, "2sg")).toBe("anlamalısın")
    expect(conjugate("necessity", anla, "3sg")).toBe("anlamalı")
    expect(conjugate("necessity", anla, "1pl")).toBe("anlamalıyız")
    expect(conjugate("necessity", anla, "2pl")).toBe("anlamalısınız")
    expect(conjugate("necessity", anla, "3pl")).toBe("anlamalılar")
  })

  it("ability ends in -ir so no extra buffer y before person", () => {
    expect(conjugate("ability", gel, "1sg")).toBe("gelebilirim")
    expect(conjugate("ability", gel, "1pl")).toBe("gelebiliriz")
    expect(conjugate("ability", yap, "1sg")).toBe("yapabilirim")
    expect(conjugate("ability", anla, "1sg")).toBe("anlayabilirim")
    expect(conjugate("ability", anla, "3sg")).toBe("anlayabilir")
  })

  it("inability uses progressive -yor (consonant before person)", () => {
    expect(conjugate("inability", gel, "1sg")).toBe("gelemiyorum")
    expect(conjugate("inability", anla, "1sg")).toBe("anlayamıyorum")
  })

  it("conditional uses consonant-initial past person endings", () => {
    expect(conjugate("basic-conditional", gel, "1sg")).toBe("gelsem")
    expect(conjugate("basic-conditional", gel, "1pl")).toBe("gelsek")
    expect(conjugate("basic-conditional", yap, "1sg")).toBe("yapsam")
    expect(conjugate("basic-conditional", anla, "1sg")).toBe("anlasam")
  })
})

describe("audit corrections", () => {
  const git = stripInfinitive("gitmek")
  const ic = stripInfinitive("içmek")
  const anla = stripInfinitive("anlamak")
  const oku = stripInfinitive("okumak")
  const gel = stripInfinitive("gelmek")
  const yap = stripInfinitive("yapmak")

  it("present continuous negation keeps citation stem (gitmiyorum, not gidmiyorum)", () => {
    expect(conjugate("present-continuous-negation", git, "1sg")).toBe("gitmiyorum")
    expect(conjugate("present-continuous-negation", git, "3sg")).toBe("gitmiyor")
    expect(conjugate("present-continuous-negation", "gid", "1sg")).toBe("gitmiyorum")
  })

  it("3pl questions take harmony from -lar/-ler (mı, not mu)", () => {
    expect(conjugate("present-continuous-questions", gel, "3pl")).toBe("geliyorlar mı?")
    expect(conjugate("present-continuous-questions", yap, "3pl")).toBe("yapıyorlar mı?")
    expect(conjugate("aorist-questions", oku, "3pl")).toBe("okurlar mı?")
  })

  it("imperative polite/plural: anlayın, gidin, okuyun", () => {
    expect(conjugate("imperative", anla, "2pl")).toBe("anlayın")
    expect(conjugate("imperative", git, "2pl")).toBe("gidin")
    expect(conjugate("imperative", oku, "2pl")).toBe("okuyun")
  })

  it("aorist: gider/içer; negative 1pl gelmeyiz (not gelmeziz)", () => {
    expect(conjugate("aorist", git, "1sg")).toBe("giderim")
    expect(conjugate("aorist", git, "3sg")).toBe("gider")
    expect(conjugate("aorist", ic, "3sg")).toBe("içer")
    expect(conjugate("aorist-negation", gel, "1pl")).toBe("gelmeyiz")
    expect(conjugate("aorist-negation", yap, "1pl")).toBe("yapmayız")
    expect(conjugate("aorist-negation", anla, "1pl")).toBe("anlamayız")
  })

  it("aorist polysyllables use four-way: konuşur/çalışır (not -ar)", () => {
    const konus = stripInfinitive("konuşmak")
    const calis = stripInfinitive("çalışmak")
    const otur = stripInfinitive("oturmak")
    expect(conjugate("aorist", konus, "3sg")).toBe("konuşur")
    expect(conjugate("aorist", konus, "2pl")).toBe("konuşursunuz")
    expect(conjugate("aorist-questions", konus, "2pl")).toBe("konuşur musunuz?")
    expect(conjugate("aorist", calis, "3sg")).toBe("çalışır")
    expect(conjugate("aorist", otur, "3sg")).toBe("oturur")
  })

  it("ability softens git→gid", () => {
    expect(conjugate("ability", git, "1sg")).toBe("gidebilirim")
    expect(conjugate("ability", git, "3sg")).toBe("gidebilir")
  })

  it("suggestion: anlayalım, gidelim, okuyalım", () => {
    expect(conjugate("suggestion-lets", anla, "1pl")).toBe("anlayalım")
    expect(conjugate("suggestion-lets", git, "1pl")).toBe("gidelim")
    expect(conjugate("suggestion-lets", oku, "1pl")).toBe("okuyalım")
  })

  it("converbs use -meden/-dikten and buffer-y", () => {
    expect(conjugate("before-doing", gel, "3sg")).toBe("gelmeden önce")
    expect(conjugate("before-doing", git, "3sg")).toBe("gitmeden önce")
    expect(conjugate("after-doing", gel, "3sg")).toBe("geldikten sonra")
    expect(conjugate("after-doing", ic, "3sg")).toBe("içtikten sonra")
    expect(conjugate("while-doing", git, "3sg")).toBe("giderken")
    expect(conjugate("while-doing", ic, "3sg")).toBe("içerken")
    expect(conjugate("by-doing", anla, "3sg")).toBe("anlayarak")
    expect(conjugate("by-doing", oku, "3sg")).toBe("okuyarak")
    expect(conjugate("without-doing", gel, "3sg")).toBe("gelmeden")
  })

  it("formulation chain for after-doing", () => {
    expect(buildFormulationChain("after-doing", "gelmek")).toBe(
      "gelmek → gel → geldik → geldikten → geldikten sonra",
    )
    expect(buildFormulationChain("after-doing", "yapmak")).toBe(
      "yapmak → yap → yaptık → yaptıktan → yaptıktan sonra",
    )
  })

  it("participles buffer-y / soften: anlayan, giden, okuyan", () => {
    expect(conjugate("basic-participles", anla, "3sg")).toBe("anlayan")
    expect(conjugate("basic-participles", git, "3sg")).toBe("giden")
    expect(conjugate("basic-participles", oku, "3sg")).toBe("okuyan")
  })

  it("indirect speech four-way harmony", () => {
    expect(conjugate("basic-indirect-speech", yap, "3sg")).toBe("yaptığını")
    expect(conjugate("basic-indirect-speech", anla, "3sg")).toBe("anladığını")
    expect(conjugate("basic-indirect-speech", oku, "3sg")).toBe("okuduğunu")
    expect(conjugate("basic-indirect-speech", gel, "3sg")).toBe("geldiğini")
  })
})

describe("all drill verbs across key structures", () => {
  const persons = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] as const
  const vowels = "aeıioöuü"
  const lastVowel = (text: string) => [...text].reverse().find((char) => vowels.includes(char)) ?? "a"
  const fourWay = (vowel: string) =>
    vowel === "e" || vowel === "i" ? "i" : vowel === "ö" || vowel === "ü" ? "ü" : vowel === "o" || vowel === "u" ? "u" : "ı"
  const twoWay = (vowel: string) => ("eiöü".includes(vowel) ? "e" : "a")
  const questionParticle = (text: string) => `m${fourWay(lastVowel(text))}`

  const yorParadigm = (third: string) => [
    `${third}um`,
    `${third}sun`,
    third,
    `${third}uz`,
    `${third}sunuz`,
    `${third}lar`,
  ]
  const pastParadigm = (third: string) => {
    const vowel = lastVowel(third)
    const high = fourWay(vowel)
    return [
      `${third}m`,
      `${third}n`,
      third,
      `${third}k`,
      `${third}n${high}z`,
      `${third}l${twoWay(vowel)}r`,
    ]
  }
  const futureParadigm = (third: string) => {
    const vowel = lastVowel(third)
    const high = fourWay(vowel)
    const softened = third.replace(/k$/, "ğ")
    return [
      `${softened}${high}m`,
      `${third}s${high}n`,
      third,
      `${softened}${high}z`,
      `${third}s${high}n${high}z`,
      `${third}l${twoWay(vowel)}r`,
    ]
  }
  const aoristParadigm = (third: string) => {
    const vowel = lastVowel(third)
    const high = fourWay(vowel)
    return [
      `${third}${high}m`,
      `${third}s${high}n`,
      third,
      `${third}${high}z`,
      `${third}s${high}n${high}z`,
      `${third}l${twoWay(vowel)}r`,
    ]
  }
  const aoristNegativeParadigm = (third: string) => {
    const negative = third.slice(0, -1)
    const vowel = lastVowel(negative)
    const high = fourWay(vowel)
    return [
      `${negative}m`,
      `${third}s${high}n`,
      third,
      `${negative}y${high}z`,
      `${third}s${high}n${high}z`,
      `${third}l${twoWay(vowel)}r`,
    ]
  }
  const necessityParadigm = (third: string) => {
    const vowel = lastVowel(third)
    const high = fourWay(vowel)
    return [
      `${third}y${high}m`,
      `${third}s${high}n`,
      third,
      `${third}y${high}z`,
      `${third}s${high}n${high}z`,
      `${third}l${twoWay(vowel)}r`,
    ]
  }
  const polarQuestionParadigm = (third: string) => {
    const vowel = lastVowel(third)
    const particle = questionParticle(third)
    const high = fourWay(vowel)
    const plural = `${third}l${twoWay(vowel)}r`
    return [
      `${third} ${particle}y${high}m?`,
      `${third} ${particle}s${high}n?`,
      `${third} ${particle}?`,
      `${third} ${particle}y${high}z?`,
      `${third} ${particle}s${high}n${high}z?`,
      `${plural} ${questionParticle(plural)}?`,
    ]
  }

  const principalParts = {
    gel: ["geliyor", "gelmiyor", "geldi", "gelmedi", "gelecek", "gelmeyecek", "gelir", "gelmez", "gelebilir", "gelemiyor", "gelmeli"],
    yap: ["yapıyor", "yapmıyor", "yaptı", "yapmadı", "yapacak", "yapmayacak", "yapar", "yapmaz", "yapabilir", "yapamıyor", "yapmalı"],
    anla: ["anlıyor", "anlamıyor", "anladı", "anlamadı", "anlayacak", "anlamayacak", "anlar", "anlamaz", "anlayabilir", "anlayamıyor", "anlamalı"],
    git: ["gidiyor", "gitmiyor", "gitti", "gitmedi", "gidecek", "gitmeyecek", "gider", "gitmez", "gidebilir", "gidemiyor", "gitmeli"],
    oku: ["okuyor", "okumuyor", "okudu", "okumadı", "okuyacak", "okumayacak", "okur", "okumaz", "okuyabilir", "okuyamıyor", "okumalı"],
    yaz: ["yazıyor", "yazmıyor", "yazdı", "yazmadı", "yazacak", "yazmayacak", "yazar", "yazmaz", "yazabilir", "yazamıyor", "yazmalı"],
    konuş: ["konuşuyor", "konuşmuyor", "konuştu", "konuşmadı", "konuşacak", "konuşmayacak", "konuşur", "konuşmaz", "konuşabilir", "konuşamıyor", "konuşmalı"],
    çalış: ["çalışıyor", "çalışmıyor", "çalıştı", "çalışmadı", "çalışacak", "çalışmayacak", "çalışır", "çalışmaz", "çalışabilir", "çalışamıyor", "çalışmalı"],
    iç: ["içiyor", "içmiyor", "içti", "içmedi", "içecek", "içmeyecek", "içer", "içmez", "içebilir", "içemiyor", "içmeli"],
    bak: ["bakıyor", "bakmıyor", "baktı", "bakmadı", "bakacak", "bakmayacak", "bakar", "bakmaz", "bakabilir", "bakamıyor", "bakmalı"],
  } as const

  it.each(Object.entries(principalParts))("matches every audited form for %s", (stem, parts) => {
    const [present, presentNeg, past, pastNeg, future, futureNeg, aorist, aoristNeg, ability, inability, necessity] =
      parts
    const expected: Record<string, string[]> = {
      "present-continuous": yorParadigm(present),
      "present-continuous-negation": yorParadigm(presentNeg),
      "present-continuous-questions": polarQuestionParadigm(present),
      "simple-past": pastParadigm(past),
      "simple-past-negation": pastParadigm(pastNeg),
      "simple-past-questions": pastParadigm(past).map((form) => `${form} ${questionParticle(form)}?`),
      future: futureParadigm(future),
      "future-negation": futureParadigm(futureNeg),
      "future-questions": polarQuestionParadigm(future),
      aorist: aoristParadigm(aorist),
      "aorist-negation": aoristNegativeParadigm(aoristNeg),
      "aorist-questions": polarQuestionParadigm(aorist),
      ability: aoristParadigm(ability),
      inability: yorParadigm(inability),
      necessity: necessityParadigm(necessity),
    }

    for (const [structure, forms] of Object.entries(expected)) {
      persons.forEach((person, index) => {
        expect(conjugate(structure, stem, person), `${structure}/${stem}/${person}`).toBe(forms[index])
      })
    }
  })
})

describe("productive harmony rules beyond the drill list", () => {
  it("uses -ar/-er for regular monosyllables and four-way suffixes for exceptions", () => {
    expect(conjugate("aorist", "sev", "3sg")).toBe("sever")
    expect(conjugate("aorist", "kes", "3sg")).toBe("keser")
    expect(conjugate("aorist", "aç", "3sg")).toBe("açar")
    expect(conjugate("aorist", "gel", "3sg")).toBe("gelir")
    expect(conjugate("aorist", "gör", "3sg")).toBe("görür")
    expect(conjugate("aorist", "bul", "3sg")).toBe("bulur")
  })

  it("drops final a/e using the preceding vowel and handles de/ye", () => {
    expect(conjugate("present-continuous", "bekle", "3sg")).toBe("bekliyor")
    expect(conjugate("present-continuous", "söyle", "3sg")).toBe("söylüyor")
    expect(conjugate("present-continuous", "de", "3sg")).toBe("diyor")
    expect(conjugate("present-continuous", "ye", "3sg")).toBe("yiyor")
  })
})

describe("englishGlossForForm", () => {
  it("keeps person + verb meaning as clear tensed sentences", () => {
    expect(
      englishGlossForForm({ structureId: "aorist", verbEnglish: "to write", person: "1pl" }),
    ).toBe("we usually write.")
    expect(
      englishGlossForForm({ structureId: "present-continuous", verbEnglish: "to go", person: "1sg" }),
    ).toBe("I am going right now.")
    expect(
      englishGlossForForm({ structureId: "imperative", verbEnglish: "come", person: "2sg" }),
    ).toBe("Come!")
    expect(
      englishGlossForForm({
        structureId: "basic-causative",
        verbEnglish: "to read",
        person: "2sg",
      }),
    ).toBe("you (sg) made someone read.")
    expect(
      englishGlossForForm({
        structureId: "accusative",
        verbEnglish: "house",
        person: "3sg",
        nounEnglish: "house",
      }),
    ).toBe("the house")
  })
})
