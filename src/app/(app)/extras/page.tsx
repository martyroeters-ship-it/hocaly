import Link from "next/link"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const EXTRAS = [
  {
    href: "/study",
    title: "SRS Reviews",
    text: "Classic spaced-repetition queue with Again / Hard / Good / Easy.",
  },
  {
    href: "/tests",
    title: "Word tests hub",
    text: "Mixed recognition, cloze, listening, and sentence modes.",
  },
  {
    href: "/stories",
    title: "Stories",
    text: "Generate short Turkish stories from selected vocabulary.",
  },
  {
    href: "/listen",
    title: "Listening clips",
    text: "Comprehension practice with short AI clips.",
  },
  {
    href: "/speak",
    title: "Speaking drills",
    text: "Listen-repeat, translate out loud, and push-to-talk practice.",
  },
  {
    href: "/progress",
    title: "Progress stats",
    text: "Heatmaps, CEFR coverage bars, and study history.",
  },
  {
    href: "/profile",
    title: "Profile",
    text: "Default CEFR and learner preferences.",
  },
]

export default function ExtrasPage() {
  return (
    <div>
      <PageHero
        title="Extras"
        subtitle="Tools kept available but out of the main Grammar + Vocabulary flow."
      />
      <PageBody className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTRAS.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full border-0 shadow-none ring-1 ring-black/8 transition-colors hover:bg-accent/40">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Open →</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageBody>
    </div>
  )
}
