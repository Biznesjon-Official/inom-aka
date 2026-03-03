import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Category from '@/models/Category'
import Product from '@/models/Product'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const productCount = await Product.countDocuments({ category: id, isActive: true })
    if (productCount > 0) {
      return NextResponse.json({ error: `Bu kategoriyada ${productCount} ta tovar bor, o'chirib bo'lmaydi` }, { status: 400 })
    }
    await Category.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const category = await Category.findByIdAndUpdate(id, body, { new: true })
    return NextResponse.json(category)
  } catch (err) { return errorResponse(err) }
}
