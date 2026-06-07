import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default function ResetPassword({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  const updatePassword = async (formData: FormData) => {
    'use server'

    const password = formData.get('password') as string
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      return redirect(`/reset-password?message=${encodeURIComponent(error.message)}`)
    }

    return redirect('/login?message=Password updated successfully')
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 py-24 mx-auto">
      <form
        className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
        action={updatePassword}
      >
        <h1 className="text-2xl font-bold mb-6">Reset Password</h1>
        <label className="text-md" htmlFor="password">
          New Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        <button className="bg-green-700 rounded-md px-4 py-2 text-foreground mb-2">
          Update Password
        </button>
        {searchParams?.message && (
          <p className="mt-4 p-4 bg-foreground/10 text-foreground text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
