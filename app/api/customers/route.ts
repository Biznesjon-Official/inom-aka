import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Customer from '@/models/Customer'
import { escapeRegex } from '@/lib/utils'

export async function GET(req: Request) {
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
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const customer = await Customer.create(body)
  return NextResponse.json(customer, { status: 201 })
}
