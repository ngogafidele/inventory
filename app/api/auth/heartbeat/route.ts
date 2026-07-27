// Restamps session activity for users reading a page without issuing requests.
// The proxy refreshes the auth cookie on every authenticated request, so this
// handler only has to exist and return; the idle guard calls it on real input.
import { NextResponse } from "next/server"

export async function POST() {
  return new NextResponse(null, { status: 204 })
}
