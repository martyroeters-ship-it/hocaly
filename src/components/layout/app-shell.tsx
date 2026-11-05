"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpenCheck,
  LayoutDashboard,
  Library,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Sparkles,
} from "lucide-react"
import { FeedbackWidget } from "@/components/feedback/feedback-widget"
import { SelectionTranslateMenu } from "@/components/translate/selection-menu"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/grammar", label: "Grammar", icon: Sparkles },
  { href: "/vocabulary", label: "Vocabulary", icon: Library },
  { href: "/transcripts", label: "Transcripts", icon: BookOpenCheck },
  { href: "/dialogue", label: "Dialogue", icon: MessageCircle },
  { href: "/extras", label: "Extras", icon: MoreHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
]

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/"
  if (href === "/extras") {
    return (
      pathname.startsWith("/extras") ||
      pathname.startsWith("/stories") ||
      pathname.startsWith("/listen") ||
      pathname.startsWith("/speak") ||
      pathname.startsWith("/tests") ||
      pathname.startsWith("/study") ||
      pathname.startsWith("/progress") ||
      pathname.startsWith("/profile")
    )
  }
  if (href === "/vocabulary") {
    return pathname.startsWith("/vocabulary")
  }
  return pathname.startsWith(href)
}

function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/hocaly-logo.png"
      alt="Hocaly"
      width={1024}
      height={342}
      className={cn("h-auto w-auto object-contain object-left", className)}
    />
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-full bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-black/8 bg-white px-4 pb-6 pt-10 md:flex">
        <Link href="/" className="mb-3 block px-1">
          <BrandMark className="h-12 w-auto max-w-full" />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = isNavActive(item.href, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[15px] transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="block">
              <BrandMark className="h-9 w-auto" />
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
            {NAV.map((item) => {
              const active = isNavActive(item.href, pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs",
                    active ? "bg-accent font-medium text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>
        {/* Full-bleed so PageHero can paint edge-to-edge; pages constrain content via PageBody. */}
        <main className="mx-auto w-full max-w-none px-0 pt-0 pb-0">{children}</main>
      </div>
      <SelectionTranslateMenu />
      <FeedbackWidget />
    </div>
  )
}
