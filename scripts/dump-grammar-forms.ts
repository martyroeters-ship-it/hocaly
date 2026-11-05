/**
 * Generates grammar-forms-audit.txt from live conjugator + GRAMMAR_STRUCTURES catalog.
 * Run: npx tsx scripts/dump-grammar-forms.ts
 */
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  GRAMMAR_DRILL_NOUNS,
  GRAMMAR_DRILL_VERBS,
  GRAMMAR_STRUCTURES,
} from "../src/lib/grammar"
import { buildParadigm } from "../src/lib/grammar/conjugate"

function isNounStructure(structure: (typeof GRAMMAR_STRUCTURES)[number]) {
  return (
    structure.category === "case" ||
    structure.category === "noun" ||
    ["plural", "locative", "dative", "ablative", "accusative", "genitive", "possessive-suffixes"].includes(
      structure.id,
    )
  )
}

function linesForParadigm(structureId: string, headword: string, english: string): string[] {
  const forms = buildParadigm(structureId, headword)
  const out: string[] = [`  Headword: ${headword} (${english})`]
  if (forms.length === 0) {
    out.push("    (no forms produced)")
    return out
  }
  for (const form of forms) {
    out.push(`    ${form.person} / ${form.label} → ${form.turkish}`)
  }
  return out
}

function main() {
  const generatedAt = new Date().toISOString()
  const lines: string[] = [
    "Turkish Vocab — Grammar forms audit",
    `Generated: ${generatedAt}`,
    "Source: live buildParadigm/conjugate + GRAMMAR_STRUCTURES.examples",
    "Drill pools: GRAMMAR_DRILL_VERBS / GRAMMAR_DRILL_NOUNS",
    "",
    "════════════════════════════════════════════════════════════════════",
    "PART 1 — Conjugable structures (full paradigms from conjugator)",
    "════════════════════════════════════════════════════════════════════",
    "",
  ]

  const conjugable = GRAMMAR_STRUCTURES.filter((s) => s.conjugable)
  for (const structure of conjugable) {
    lines.push(`────────────────────────────────────────────────────────────────────`)
    lines.push(`Structure: ${structure.id}`)
    lines.push(`Label:     ${structure.label}`)
    lines.push(`CEFR:      ${structure.cefr}`)
    lines.push(`Category:  ${structure.category}`)
    lines.push(`Section:   ${structure.section}`)
    lines.push(`Hint:      ${structure.hint}`)
    lines.push("")

    const pool = isNounStructure(structure) ? GRAMMAR_DRILL_NOUNS : GRAMMAR_DRILL_VERBS
    for (const word of pool) {
      lines.push(...linesForParadigm(structure.id, word.turkish, word.english))
      lines.push("")
    }
  }

  lines.push("════════════════════════════════════════════════════════════════════")
  lines.push("PART 2 — Static catalog examples (GRAMMAR_STRUCTURES.examples)")
  lines.push("════════════════════════════════════════════════════════════════════")
  lines.push("")

  const withExamples = GRAMMAR_STRUCTURES.filter((s) => s.examples.length > 0)
  if (withExamples.length === 0) {
    lines.push("(none)")
  }
  for (const structure of withExamples) {
    lines.push(`────────────────────────────────────────────────────────────────────`)
    lines.push(`Structure: ${structure.id}`)
    lines.push(`Label:     ${structure.label}`)
    lines.push(`CEFR:      ${structure.cefr}`)
    lines.push(`Category:  ${structure.category}`)
    lines.push(`Conjugable:${structure.conjugable ? " yes" : " no"}`)
    lines.push("")

    for (const example of structure.examples) {
      lines.push(`  Headword: ${example.verb} (${example.english})`)
      for (const form of example.forms) {
        lines.push(`    ${form.label} → ${form.turkish}`)
      }
      lines.push("")
    }
  }

  lines.push("════════════════════════════════════════════════════════════════════")
  lines.push("SUMMARY")
  lines.push("════════════════════════════════════════════════════════════════════")
  lines.push(`Conjugable structures: ${conjugable.length}`)
  lines.push(`Structures with static examples: ${withExamples.length}`)
  lines.push(`Drill verbs: ${GRAMMAR_DRILL_VERBS.map((v) => v.turkish).join(", ")}`)
  lines.push(`Drill nouns: ${GRAMMAR_DRILL_NOUNS.map((n) => n.turkish).join(", ")}`)
  lines.push("")

  const outPath = resolve(process.cwd(), "grammar-forms-audit.txt")
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8")
  console.log(`Wrote ${outPath}`)
  console.log(`  conjugable: ${conjugable.length}`)
  console.log(`  static-example structures: ${withExamples.length}`)
}

main()
