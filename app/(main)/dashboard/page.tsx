'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, ShoppingCart, TrendingDown, BookOpen } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatPrice } from '@/lib/utils'

interface DashboardData {
  today: {
    sales: number
    revenue: number
    profit: number
    expenses: number
  }
  totalDebt: number
  chart: { date: string; revenue: number; profit: number }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch('/api/dashboard').then(r => {
      if (!r.ok) { toast.error('Dashboard ma\'lumotlarini yuklashda xato'); return }
      r.json().then(setData)
    })
  }, [])

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="h-72 bg-slate-200 rounded-xl" />
      </div>
    )
  }

  const stats = [
    { label: 'Bugungi sotuv', value: data.today.sales + ' ta', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Bugungi kirim', value: formatPrice(data.today.revenue), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Bugungi foyda', value: formatPrice(data.today.profit), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Bugungi xarajat', value: formatPrice(data.today.expenses), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Umumiy qarz', value: formatPrice(data.totalDebt), icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-800">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-700">
            So&apos;nggi 7 kun — Kirim va Foyda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.chart}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} />
              <Tooltip formatter={(v) => formatPrice(Number(v))} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#colorRevenue)" name="Kirim" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#colorProfit)" name="Foyda" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
