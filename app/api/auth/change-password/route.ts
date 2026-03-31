import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import User from '@/models/User'

export async function POST(req: Request) {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Joriy va yangi parol majburiy' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' }, { status: 400 })
    }

    const user = await User.findById(session.user.id).select('+password')
    if (!user) {
      return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Joriy parol noto\'g\'ri' }, { status: 400 })
    }

    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()

    return NextResponse.json({ success: true })
  } catch (err) { return errorResponse(err) }
}
