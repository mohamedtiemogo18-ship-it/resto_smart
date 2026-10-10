'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

// Page interactive : rendue à la demande, jamais prérendue au build.
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError({ code: 'MISSING_FIELDS', message: 'Renseignez votre email et votre mot de passe.' })
      return
    }

    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (authError) {
      // Message unique et volontairement vague : il ne doit pas révéler
      // si c'est l'email ou le mot de passe qui est faux.
      setError({
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect.',
      })
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/25 px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Marque */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-xs"
          >
            R
          </span>
          <h1 className="text-2xl font-bold">Restauration universitaire</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Connectez-vous pour réserver et gérer vos tickets
          </p>
        </div>

        {/* Carte */}
        <div className="surface p-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="vous@exemple.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />
            </Field>

            <Field label="Mot de passe" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <Alert variant="destructive">
                <p>{error.message}</p>
              </Alert>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Les comptes sont créés par l'administration. Contactez le service de
          restauration si vous n'avez pas encore vos identifiants.
        </p>
      </div>
    </div>
  )
}
