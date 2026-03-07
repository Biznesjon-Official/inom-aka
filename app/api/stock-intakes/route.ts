import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import StockIntake from '@/models/StockIntake'
import Product from '@/models/Product'

export async function GET() {
  try {
    await connectDB()
    const intakes = await StockIntake.find()
      .populate('items.product', 'name unit')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(200)
      .allowDiskUse(true)
      .lean()

    return NextResponse.json(intakes)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    const body = await req.json()

    const { items, supplier, note } = body
    if (!items?.length) {
      return NextResponse.json({ error: 'Kamida 1 ta mahsulot kerak' }, { status: 400 })
    }

    // Calculate total cost
    const totalCost = items.reduce((sum: number, item: { qty: number; costPrice: number }) =>
      sum + item.qty * item.costPrice, 0)

    // Create intake record
    const intake = await StockIntake.create({
      items,
      supplier: supplier || undefined,
      note: note || undefined,
      totalCost,
      createdBy: session?.user?.id,
    })

    // Update stock and costPrice for each product
    const updateOps = items.map((item: { product: string; qty: number; costPrice: number }) =>
      Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.qty },
        $set: { costPrice: item.costPrice },
      })
    )
    await Promise.all(updateOps)

    const populated = await intake.populate([
      { path: 'items.product', select: 'name unit' },
      { path: 'createdBy', select: 'name' },
    ])

    return NextResponse.json(populated, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
