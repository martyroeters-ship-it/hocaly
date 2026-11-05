"use client"

import { cn } from "@/lib/utils"

/**
 * Drop a parenthetical already glued to the blank so `lemma` is not shown twice.
 * Handles `______ (yapmak)`, `______? (yapmak)`, and `______ (yapmak)?`.
 */
export function stripBlankLemma(text: string) {
  return text
    .replace(/_{3,}\s*\?\s*\([^)]*\)/g, "______?")
    .replace(/_{3,}\s*\([^)]*\)\s*\?/g, "______?")
    .replace(/_{3,}\s*\([^)]*\)/g, "______")
}

/** Replace ______ (or similar underscore runs) with a continuous underline / inline input. */
export function BlankPrompt({
  text,
  className,
  fill,
  tone,
  editable,
  value,
  onValueChange,
  onSubmit,
  onRevealLemma,
  autoFocus,
  placeholder = "",
  lemma,
  /** When true, strip any `(lemma)` glued to the blank even if lemma is not shown yet. */
  hideEmbeddedLemma = false,
}: {
  text: string
  className?: string
  /** Answer to show inside the blank (e.g. after checking). */
  fill?: string
  tone?: "correct" | "incorrect"
  editable?: boolean
  value?: string
  onValueChange?: (value: string) => void
  onSubmit?: () => void
  /** Tab reveals the dictionary form (e.g. çalışmak). */
  onRevealLemma?: () => void
  autoFocus?: boolean
  placeholder?: string
  /** Dictionary / base form shown after the blank, e.g. (araba) or (gelmek). */
  lemma?: string
  hideEmbeddedLemma?: boolean
}) {
  const hint = lemma?.trim()
  const display = hint || hideEmbeddedLemma ? stripBlankLemma(text) : text
  const parts = display.split(/_{3,}/)
  if (parts.length === 1) return <span className={className}>{display}</span>

  const fillClass =
    tone === "correct"
      ? "border-green-600 text-green-700"
      : tone === "incorrect"
        ? "border-red-600 text-red-700"
        : "border-foreground text-foreground"

  return (
    <span className={cn("inline leading-normal", className)}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline">
          {part}
          {index < parts.length - 1 ? (
            <>
              {editable ? (
                <input
                  autoFocus={autoFocus}
                  value={value ?? ""}
                  placeholder={placeholder || "\u00a0"}
                  aria-label={hint ? `Fill in the blank for ${hint}` : "Fill in the blank"}
                  onChange={(event) => onValueChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && onRevealLemma) {
                      event.preventDefault()
                      onRevealLemma()
                      return
                    }
                    if (event.key === "Enter") {
                      event.preventDefault()
                      onSubmit?.()
                    }
                  }}
                  className={cn(
                    "mx-1 inline-block w-[8.5rem] border-0 border-b-2 border-foreground bg-transparent px-0.5 py-0",
                    "align-baseline text-inherit font-semibold outline-none",
                    "placeholder:text-transparent focus:border-primary",
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "mx-1 inline-block min-w-[6rem] border-b-2 align-baseline font-semibold leading-none",
                    fillClass,
                  )}
                  aria-label={fill ? `answer: ${fill}` : "blank"}
                >
                  {fill || "\u00a0"}
                </span>
              )}
              {hint ? (
                <span className="font-normal text-muted-foreground"> ({hint})</span>
              ) : null}
            </>
          ) : null}
        </span>
      ))}
    </span>
  )
}
