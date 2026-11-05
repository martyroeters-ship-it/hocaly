import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"
import { GRAMMAR_DRILL_NOUNS, GRAMMAR_DRILL_VERBS, GRAMMAR_STRUCTURES, getStructure } from "@/lib/grammar"
import { buildParadigm } from "@/lib/grammar/conjugate"

const VOICE = new Set(["reciprocal-verbs", "reflexive-verbs", "basic-passive", "basic-causative"])

function parseCorrected(text: string) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith("Turkish Vocab — Grammar forms audit"))
  const slice = lines.slice(Math.max(0, start))
  const forms = new Map<string, string>()
  let structure = ""
  let headword = ""
  let part = "1"
  for (const line of slice) {
    if (line.includes("PART 2") || line.includes("Static catalog")) part = "2"
    if (line.startsWith("Structure: ")) {
      structure = line.slice("Structure: ".length).trim()
      headword = ""
      continue
    }
    if (line.startsWith("  Headword: ")) {
      headword = line.slice("  Headword: ".length).split(" (")[0]!.trim()
      continue
    }
    if (part !== "1" || VOICE.has(structure) || !structure || !headword) continue
    if (!line.includes("→")) continue
    const [left, right] = line.split("→")
    const label = left!.trim()
    const form = right!.trim()
    forms.set(`${structure}|${headword}|${label}`, form)
  }
  return forms
}

describe("live paradigms vs corrected audit", () => {
  const corrected = parseCorrected(
    readFileSync(resolve(process.cwd(), "grammar-forms-audit-corrected.txt"), "utf8"),
  )

  it("matches all non-voice conjugable forms from the corrected audit", () => {
    const mismatches: string[] = []
    const checked = new Set<string>()

    for (const structure of GRAMMAR_STRUCTURES) {
      if (!structure.conjugable || VOICE.has(structure.id)) continue
      const isNoun =
        structure.category === "case" ||
        structure.category === "noun" ||
        ["plural", "locative", "dative", "ablative", "accusative", "genitive", "possessive-suffixes"].includes(
          structure.id,
        )
      const pool = isNoun ? GRAMMAR_DRILL_NOUNS : GRAMMAR_DRILL_VERBS
      for (const word of pool) {
        for (const form of buildParadigm(structure.id, word.turkish)) {
          const label = `${form.person} / ${form.label}`
          const key = `${structure.id}|${word.turkish}|${label}`
          const expected = corrected.get(key)
          // Non-person forms use headword as label in dump
          const key2 = `${structure.id}|${word.turkish}|3sg / ${word.turkish}`
          const expected2 = corrected.get(key2)
          const want = expected ?? expected2
          const useKey = expected ? key : key2
          if (!want) continue
          checked.add(useKey)
          if (form.turkish !== want) {
            mismatches.push(`${useKey}: live=${form.turkish} expected=${want}`)
          }
        }
      }
    }

    // Also catch any corrected forms we failed to produce
    const missing: string[] = []
    for (const [key, want] of corrected) {
      const [structureId] = key.split("|")
      if (VOICE.has(structureId!)) continue
      const structure = getStructure(structureId!)
      if (!structure?.conjugable) continue
      if (checked.has(key)) continue
      // try rebuild
      const [, head, label] = key.split("|")
      const paradigm = buildParadigm(structureId!, head!)
      const hit = paradigm.find((f) => `${f.person} / ${f.label}` === label)
      if (!hit) missing.push(`${key} (expected ${want})`)
      else if (hit.turkish !== want) mismatches.push(`${key}: live=${hit.turkish} expected=${want}`)
    }

    expect({ mismatches, missing, checked: checked.size }).toEqual({
      mismatches: [],
      missing: [],
      checked: checked.size,
    })
  })
})
