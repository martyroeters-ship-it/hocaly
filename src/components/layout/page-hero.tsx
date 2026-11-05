import { cn } from "@/lib/utils"

type PageHeroProps = {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Small line above the title (e.g. "Welcome back"). */
  eyebrow?: React.ReactNode
  /** Buttons or controls aligned with the title on larger screens. */
  actions?: React.ReactNode
  /** Extra bottom padding so content can overlap the pink block. */
  overlap?: boolean
  className?: string
}

export function PageHero({ title, subtitle, eyebrow, actions, overlap, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "bg-hero px-4 pt-16 md:px-8 md:pt-20",
        overlap ? "pb-20" : "pb-14 md:pb-16",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">
        {eyebrow ? <p className="text-sm text-foreground/70">{eyebrow}</p> : null}
        <div
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
            eyebrow ? "mt-1" : undefined,
          )}
        >
          <div className="min-w-0 flex-1">
            <h1 className="page-title md:text-4xl">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-xl text-sm text-foreground/70">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </section>
  )
}

type PageBodyProps = {
  children: React.ReactNode
  className?: string
  /** Narrower reading column (settings, profile, active dialogue). */
  narrow?: boolean
}

/** Constrained content block below a full-bleed {@link PageHero}. */
export function PageBody({ children, className, narrow }: PageBodyProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-16 pt-8 md:px-8 md:pb-16",
        narrow ? "max-w-2xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  )
}
