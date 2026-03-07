import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // API routes — role-based access
    if (path.startsWith('/api/')) {
      const adminOnlyAPIs = ['/api/workers', '/api/expenses', '/api/expense-sources', '/api/dashboard', '/api/categories', '/api/customers', '/api/reports', '/api/settings']
      const isAdminOnly = adminOnlyAPIs.some(r => path.startsWith(r))
      // Products: GET allowed for worker (kassa needs it), POST/PUT/DELETE admin only
      const isProductWrite = path.startsWith('/api/products') && req.method !== 'GET'

      if ((isAdminOnly || isProductWrite) && token?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.next()
    }

    // Worker can only access /kassa and /qarzlar
    if (token?.role === 'worker' && !path.startsWith('/kassa') && !path.startsWith('/qarzlar') && path !== '/login') {
      return NextResponse.redirect(new URL('/kassa', req.url))
    }

    // Admin-only routes
    const adminRoutes = ['/dashboard', '/tovarlar', '/sotuvlar', '/xarajatlar', '/mijozlar', '/ishchilar', '/hisobot', '/sozlamalar']
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
  matcher: ['/dashboard/:path*', '/kassa/:path*', '/tovarlar/:path*', '/sotuvlar/:path*', '/qarzlar/:path*', '/xarajatlar/:path*', '/mijozlar/:path*', '/ishchilar/:path*', '/sozlamalar/:path*', '/hisobot/:path*', '/api/customers/:path*', '/api/products/:path*', '/api/sales/:path*', '/api/debts/:path*', '/api/workers/:path*', '/api/expenses/:path*', '/api/expense-sources/:path*', '/api/dashboard/:path*', '/api/categories/:path*', '/api/settings/:path*', '/api/reports/:path*', '/api/saved-carts/:path*', '/api/product-stats/:path*'],
}
