import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Worker can only access /kassa and /qarzlar
    if (token?.role === 'worker' && !path.startsWith('/kassa') && !path.startsWith('/qarzlar') && path !== '/login') {
      return NextResponse.redirect(new URL('/kassa', req.url))
    }

    // Admin-only routes
    const adminRoutes = ['/dashboard', '/tovarlar', '/xarajatlar', '/mijozlar', '/ishchilar']
    if (adminRoutes.some(r => path.startsWith(r)) && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/kassa', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/kassa/:path*', '/tovarlar/:path*', '/qarzlar/:path*', '/xarajatlar/:path*', '/mijozlar/:path*', '/ishchilar/:path*'],
}
