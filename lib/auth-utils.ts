import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

/**
 * Check if user is authenticated
 * Returns session if authenticated, otherwise returns 401 response
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  
  return { session, response: null }
}

/**
 * Check if user is admin
 * Returns session if admin, otherwise returns 403 response
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  
  if (session.user.role !== 'admin') {
    return {
      session,
      response: NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }
  }
  
  return { session, response: null }
}

/**
 * Check if user has specific role
 */
export async function requireRole(role: 'admin' | 'worker') {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  
  if (session.user.role !== role) {
    return {
      session,
      response: NextResponse.json({ error: `Forbidden - ${role} only` }, { status: 403 })
    }
  }
  
  return { session, response: null }
}
