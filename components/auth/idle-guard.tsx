"use client"

// Signs the user out after a stretch of no real input on sensitive pages.
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { STRICT_IDLE_TIMEOUT_SECONDS } from "@/lib/auth/idle"

// Deliberately no "scroll": a scroll event is also emitted by scroll
// restoration and by anything calling scrollTo, so it would report activity
// with nobody at the desk. Watching the inputs that cause scrolling instead
// still covers someone reading a long report inside an overflow container —
// by wheel, by touch drag, by arrow key, or by dragging the scrollbar, which
// arrives as mousedown and mousemove.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "touchstart",
  "touchmove",
] as const

// Capture phase so a child calling stopPropagation cannot hide input from us.
const LISTENER_OPTIONS = { passive: true, capture: true } as const

const CHECK_INTERVAL_MS = 15 * 1000

export function IdleGuard({
  timeoutMs = STRICT_IDLE_TIMEOUT_SECONDS * 1000,
  heartbeatMs = 2 * 60 * 1000,
}: {
  timeoutMs?: number
  heartbeatMs?: number
}) {
  const router = useRouter()
  // Seeded on mount rather than during render, which must stay pure.
  const lastActivityRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const signingOutRef = useRef(false)

  useEffect(() => {
    lastActivityRef.current = Date.now()
    lastHeartbeatRef.current = Date.now()

    const signOut = async () => {
      if (signingOutRef.current) return
      signingOutRef.current = true

      try {
        await fetch("/api/auth/logout", { method: "POST" })
      } catch {
        // Still redirect: the cookie is past its idle window server-side.
      }

      router.push("/?reason=idle")
      router.refresh()
    }

    const sendHeartbeat = async () => {
      let response: Response
      try {
        response = await fetch("/api/auth/heartbeat", { method: "POST" })
      } catch {
        // Network blip. The session may well still be alive, so leave it be
        // and let the next heartbeat settle it.
        return
      }

      // The proxy clears the cookie and answers 401 once the server-side idle
      // window has closed, which it can do before this timer fires because the
      // heartbeat only restamps every heartbeatMs. Without this check the guard
      // would keep trusting a dead session and never sign out, since the user
      // is still producing activity.
      if (!response.ok) {
        await signOut()
      }
    }

    const handleActivity = () => {
      const now = Date.now()
      lastActivityRef.current = now

      // Reading a page issues no requests, so the server-side clock would
      // expire an active user. Only real input reaches here, so a genuinely
      // idle tab still goes quiet and still times out.
      if (now - lastHeartbeatRef.current >= heartbeatMs) {
        lastHeartbeatRef.current = now
        void sendHeartbeat()
      }
    }

    // Comparing wall-clock timestamps rather than trusting one long timer keeps
    // this correct when the machine sleeps and fires the callback late.
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        void signOut()
      }
    }, CHECK_INTERVAL_MS)

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, LISTENER_OPTIONS)
    }

    return () => {
      window.clearInterval(interval)
      for (const event of ACTIVITY_EVENTS) {
        // Must repeat the capture flag or the listener is not the one removed.
        window.removeEventListener(event, handleActivity, LISTENER_OPTIONS)
      }
    }
  }, [heartbeatMs, router, timeoutMs])

  return null
}
