import type { Metadata } from "next"
import type { ReactNode } from "react"
import { DM_Sans, Source_Serif_4 } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
})

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
})

export const metadata: Metadata = {
  title: {
    default: "Hocaly",
    template: "Hocaly",
  },
  applicationName: "Hocaly",
  description: "Learn Turkish vocabulary in context with active recall and spaced repetition.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
