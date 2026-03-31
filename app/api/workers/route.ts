import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { requireAuth, requireAdmin } from '@/lib/auth-utils'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  try {
    await connectDB()
    const workers = await User.find({ role: 'worker', isActive: true }).select('-password').sort({ name: 1 }).lean()
    return NextResponse.json(workers)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  const { response } = await requireAdmin()
  if (response) return response

  try {
    await connectDB()
    const body = await req.json()
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    if (!body.username?.trim()) return NextResponse.json({ error: 'Username required' }, { status: 400 })
    if (!body.password || body.password.length < 6) return NextResponse.json({ error: 'Parol kamida 6 ta belgi bo\'lishi kerak' }, { status: 400 })
    const hashed = await bcrypt.hash(body.password, 10)
    const worker = await User.create({ name: body.name.trim(), username: body.username.trim(), password: hashed, role: 'worker', salary: body.salary })
    const { password: _, ...rest } = worker.toObject()
    return NextResponse.json(rest, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
