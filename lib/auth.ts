import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './db'
import User from '@/models/User'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) return null

          await connectDB()
          const user = await User.findOne({ username: credentials.username, isActive: true }).select('+password').lean()
          if (!user) return null

          const isValid = await bcrypt.compare(credentials.password, user.password as string)
          if (!isValid) return null

          return {
            id: (user._id as { toString(): string }).toString(),
            name: user.name as string,
            username: user.username as string,
            role: user.role as string,
          }
        } catch (err) {
          console.error('[auth] error:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as unknown as { role: string }).role
        token.username = (user as unknown as { username: string }).username
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.username = token.username as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // maxAge yo'q — brauzer yopilganda session o'chadi
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
