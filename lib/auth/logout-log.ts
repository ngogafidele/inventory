// Records the end of a session in the audit log. Called from two places — the
// logout route, and the proxy when it first sees a lapsed token — so the write
// is guarded to only ever close a row that is still open.
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { UserLoginLog } from "@/lib/db/models/UserLoginLog"
import type { AuthSession } from "@/lib/auth/session"

export async function recordLogout(
  session: Pick<AuthSession, "userId" | "loginLogId">
) {
  try {
    await connectToDatabase()
    const logoutAt = new Date()

    // Guarded on logoutAt so whichever caller arrives second is a no-op rather
    // than overwriting the real logout time, and so a replayed lapsed token
    // cannot restamp a row that has already closed.
    if (session.loginLogId) {
      await UserLoginLog.findOneAndUpdate(
        { _id: session.loginLogId, logoutAt: { $exists: false } },
        { logoutAt }
      )
    } else {
      await UserLoginLog.findOneAndUpdate(
        { userId: session.userId, logoutAt: { $exists: false } },
        { logoutAt },
        { sort: { loginAt: -1 } }
      )
    }

    await User.findByIdAndUpdate(session.userId, { lastLogout: logoutAt })
  } catch (error) {
    console.error("[Logout Error]", error)
  }
}
