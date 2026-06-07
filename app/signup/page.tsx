import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default function Signup({
  searchParams,
}: {
  searchParams: { message: string; invite_code?: string }
}) {
  const signUp = async (formData: FormData) => {
    'use server'

    const origin = headers().get('origin')
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const inviteCode = formData.get('invite_code') as string
    
    // Simple invite code check. In a production app, you would verify this against a database table.
    // For now, we use an environment variable or a hardcoded fallback.
    const VALID_INVITE_CODE = process.env.SIGNUP_INVITE_CODE || 'CHANGELOG_2026'

    if (inviteCode !== VALID_INVITE_CODE) {
      return redirect(`/signup?message=${encodeURIComponent('Invalid invite code. Please contact the administrator.')}`)
    }

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
    }

    return redirect('/signup?message=Check email to continue sign in process')
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 py-24 mx-auto">
      <Link
        href="/login"
        className="absolute left-8 top-8 py-2 px-4 rounded-md no-underline text-foreground bg-btn-background hover:bg-btn-background-hover flex items-center group text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>{' '}
        Back to Login
      </Link>

      <form
        className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
        action={signUp}
      >
        <h1 className="text-2xl font-bold mb-6">Create an account</h1>
        
        <label className="text-md" htmlFor="invite_code">
          Invite Code
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="invite_code"
          placeholder="Enter your invite code"
          defaultValue={searchParams.invite_code || ''}
          required
        />

        <label className="text-md" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          placeholder="you@example.com"
          required
        />
        
        <label className="text-md" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
        
        <button className="bg-green-700 rounded-md px-4 py-2 text-foreground mb-2">
          Sign Up
        </button>
        
        <p className="text-sm text-center mt-2">
          Already have an account?{' '}
          <Link href="/login" className="underline font-medium">
            Log In
          </Link>
        </p>
        
        {searchParams?.message && (
          <p className="mt-4 p-4 bg-foreground/10 text-foreground text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
