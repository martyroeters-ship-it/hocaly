"use client"

import Link from "next/link"
import { ClipboardList, MessagesSquare, Mic, Volume2 } from "lucide-react"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ITEMS = [
  {
    href: "/tests/study",
    title: "Test",
    text: "Quiz your words. Pick a set and check what you know.",
    icon: ClipboardList,
    variant: "default" as const,
  },
  {
    href: "/listen",
    title: "Listen",
    text: "Hear selected words in a short Turkish clip.",
    icon: Volume2,
    variant: "outline" as const,
  },
  {
    href: "/speak",
    title: "Speak",
    text: "Repeat, translate out loud, or hold a push-to-talk conversation.",
    icon: Mic,
    variant: "outline" as const,
  },
  {
    href: "/dialogue",
    title: "Dialogue",
    text: "Role-play a scene in Turkish — restaurant, bus station, or your own topic.",
    icon: MessagesSquare,
    variant: "outline" as const,
  },
]

export function BackToTestsLink() {
  return (
    <Button nativeButton={false} variant="ghost" size="sm" className="-ml-2.5 mb-2" render={<Link href="/tests" />}>
      ← Study
    </Button>
  )
}

export function TestsHub() {
  return (
    <div>
      <PageHero title="Study" subtitle="Choose how you want to practice." />
      <PageBody className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              buttonVariants({ variant: item.variant }),
              "h-auto min-h-56 w-full flex-col items-start justify-between gap-10 whitespace-normal rounded-xl p-6 text-left",
            )}
          >
            <item.icon className="size-8" />
            <span className="block">
              <span className="block text-2xl font-black tracking-tight">{item.title}</span>
              <span
                className={
                  item.variant === "default"
                    ? "mt-2 block text-sm font-medium text-primary-foreground/75"
                    : "mt-2 block text-sm font-medium text-muted-foreground"
                }
              >
                {item.text}
              </span>
            </span>
          </Link>
        ))}
      </div>
      </PageBody>
    </div>
  )
}
