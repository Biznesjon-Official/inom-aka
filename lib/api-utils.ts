import { NextResponse } from 'next/server'

export function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error('[API Error]', message)
  // CastError = invalid ObjectId
  if (err instanceof Error && err.name === 'CastError') {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
  }
  return NextResponse.json({ error: message }, { status: 500 })
}
