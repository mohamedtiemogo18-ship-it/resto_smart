import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/mot-de-passe-oublie', '/auth/callback']

const PROTECTED: Record<string, string> = {
  '/etudiant': 'student',
  '/guichet': 'logistician',
  '/admin': 'admin',
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit la session si besoin. Indispensable pour que les Server
  // Components voient un utilisateur à jour.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Vérification de rôle volontairement absente ici.
  //
  // Le middleware ne lit plus la table `profiles` via Supabase : le rôle est
  // une donnée de sécurité et sa source de vérité est le backend. La garde
  // fine est faite dans chaque layout (server component), qui appelle
  // `/auth/me`. On évite ainsi un appel réseau supplémentaire à chaque
  // requête, et une dépendance au service REST de Supabase.
  const prefix = Object.keys(PROTECTED).find((p) => pathname.startsWith(p))
  if (prefix && user) {
    response.headers.set('x-required-role', PROTECTED[prefix])
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
}
