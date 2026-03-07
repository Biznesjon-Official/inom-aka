import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import SavedCart from '@/models/SavedCart'

export async function GET() {
  try {
    await connectDB()
    const carts = await SavedCart.find()
      .populate('items.product', 'name unit salePrice costPrice discountPrice discountThreshold stock image')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean()
    return NextResponse.json(carts)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const cart = await SavedCart.create(body)
    return NextResponse.json(cart, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
