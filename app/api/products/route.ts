import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import { escapeRegex } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const filter: Record<string, unknown> = {}
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }
    if (category) filter.category = category
    if (active !== 'all') filter.isActive = true

    const products = await Product.find(filter).sort({ createdAt: -1 }).limit(200).allowDiskUse(true).populate('category').lean()
    return NextResponse.json(products)
  } catch (err) {
    console.error('Products GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const product = await Product.create(body)
  return NextResponse.json(product, { status: 201 })
}
