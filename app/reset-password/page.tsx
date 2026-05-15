import { ResetPasswordForm } from "@/app/reset-password/reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams

  return (
    <div className="brand-auth-surface min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8 sm:px-6">
        <ResetPasswordForm token={token} />
      </main>
    </div>
  )
}
