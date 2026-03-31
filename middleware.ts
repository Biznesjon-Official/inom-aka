import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Allow authenticated users to access all routes
    if (token) {
      return NextResponse.next()
    }

    // Redirect unauthenticated users to login
    if (!path.startsWith('/login')) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page and auth API
        if (req.nextUrl.pathname.startsWith('/login') || 
            req.nextUrl.pathname.startsWith('/api/auth')) {
          return true
        }
        // Require token for all other routes
        return !!token
      },
    },
  }
)

// Protect all routes except login, auth API, and public assets
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     * - /uploads/* (public uploads)
     */
    '/((?!_next|favicon.ico|robots.txt|uploads).*)',
  ],
}
