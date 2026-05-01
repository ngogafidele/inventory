import { ResetPasswordForm } from "@/app/reset-password/reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,_#d5f5e3_0,_transparent_45%),radial-gradient(circle_at_85%_10%,_#fef3c7_0,_transparent_40%),linear-gradient(to_bottom,_#f8fafc,_#f3f4f6)]">
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8 sm:px-6">
        <ResetPasswordForm token={token} />
      </main>
    </div>
  )
}
