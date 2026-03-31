import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SavedCart from '@/models/SavedCart'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    const { id } = await params
    const cart = await SavedCart.findById(id)
    if (!cart) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Worker can only delete own saved carts
    if (session?.user?.role === 'worker' && cart.createdBy?.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await SavedCart.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}
