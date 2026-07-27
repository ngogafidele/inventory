// Stands in front of the sensitive pages until the signed-in user re-enters
// their password. Renders instead of the page it guards, so nothing it
// protects has been fetched or sent to the browser by the time it appears.
import { redirect } from "next/navigation"
import { requireServerSession } from "@/lib/auth/server"
import { isReauthCurrent, requiresReauth } from "@/lib/auth/reauth"
import { ReauthForm } from "@/components/auth/reauth-form"

const DEFAULT_TARGET = "/dashboard"

type SearchParams = Promise<{ next?: string }>

// Only ever forward to a path this gate actually protects. Without that check
// the `next` parameter would be an open redirect onto any URL an attacker
// could get an admin to click.
function resolveTarget(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_TARGET
  }
  // "/dashboard/../../elsewhere" passes the prefix test but normalizes away
  // from the gated route once the browser resolves it.
  if (value.includes("..")) {
    return DEFAULT_TARGET
  }
  const [pathname] = value.split("?")
  return requiresReauth(pathname) ? value : DEFAULT_TARGET
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await requireServerSession()
  const { next } = await searchParams
  const target = resolveTarget(next)

  // Already proven inside the window — usually a stale prefetch or a back
  // button. Nothing to ask for, so send them on.
  if (isReauthCurrent(session)) {
    redirect(target)
  }

  return <ReauthForm target={target} email={session.email} />
}
