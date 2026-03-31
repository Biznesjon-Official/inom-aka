'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Store, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', {
      ...form,
      redirect: false,
    })
    setLoading(false)

    if (res?.error) {
      toast.error('Login yoki parol noto\'g\'ri')
      return
    }

    // Fetch session to get role
    const sessionRes = await fetch('/api/auth/session')
    const session = await sessionRes.json()
    if (session?.user?.role === 'admin') {
      router.push('/dashboard')
    } else {
      router.push('/kassa')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">Inomaka CRM</CardTitle>
          <p className="text-sm text-slate-500">Tizimga kirish</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Login</Label>
              <Input
                id="username"
                placeholder="username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Parol</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass(s => !s)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Kirish...' : 'Kirish'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
