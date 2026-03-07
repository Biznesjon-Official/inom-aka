import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
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

    // Exclude image from list query to avoid MongoDB 32MB sort memory limit
    const products = await Product.find(filter, { image: 0 })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
    return NextResponse.json(products)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const { name, costPrice, salePrice } = body
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    if (typeof costPrice !== 'number' || costPrice < 0) return NextResponse.json({ error: 'Invalid costPrice' }, { status: 400 })
    if (typeof salePrice !== 'number' || salePrice <= 0) return NextResponse.json({ error: 'Invalid salePrice' }, { status: 400 })
    const product = await Product.create(body)
    return NextResponse.json(product, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
