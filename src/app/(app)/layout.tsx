import { Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"

function AppShellFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-none px-0 pt-0 pb-0">{children}</main>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // AppShell reads usePathname(); with Cache Components it must sit behind Suspense
  // so prerender can emit a static shell when pathname resolution suspends.
  return (
    <Suspense fallback={<AppShellFallback>{children}</AppShellFallback>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  )
}
