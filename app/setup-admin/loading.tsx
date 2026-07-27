// Mirrors the admin setup page: the form card leads on this route, with the
// branding column beside it — the reverse of the login page's ordering.
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="brand-auth-surface min-h-screen">
      <main
        role="status"
        aria-label="Loading admin setup"
        className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-10"
      >
        <section className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-xl sm:p-7">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-sm" />
          {/* Name, email, password, confirm password */}
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
          <Skeleton className="h-11 w-full" />
        </section>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-24 rounded-xl" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-72 max-w-full" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
