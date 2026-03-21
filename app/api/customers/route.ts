import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Customer from '@/models/Customer'
import { escapeRegex } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const filter: Record<string, unknown> = {}
    if (search) {
      const escaped = escapeRegex(search)
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ]
    }
    const customers = await Customer.find(filter).sort({ name: 1 }).limit(200).lean()
    return NextResponse.json(customers)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const customer = await Customer.create({ 
      name: body.name.trim(), 
      phone: body.phone, 
      address: body.address, 
      note: body.note,
      cashbackPercent: body.cashbackPercent || 0,
      cashbackStartDate: body.cashbackStartDate ? new Date(body.cashbackStartDate) : undefined,
      cashbackEndDate: body.cashbackEndDate ? new Date(body.cashbackEndDate) : undefined,
    })
    return NextResponse.json(customer, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
