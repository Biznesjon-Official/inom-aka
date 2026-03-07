'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TrendingUp, TrendingDown, ShoppingCart, BookOpen, DollarSign,
  Package, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Banknote, CreditCard, Smartphone,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { formatPrice } from '@/lib/utils'

interface DashboardData {
  today: { sales: number; revenue: number; profit: number; expenses: number; netProfit: number }
  month: { sales: number; revenue: number; profit: number; expenses: number; netProfit: number }
  lastMonth: { sales: number; revenue: number; profit: number; expenses: number; netProfit: number }
  totalDebt: number
  totalProducts: number
  warehouseValue: number
  chart: { date: string; revenue: number; profit: number; expense: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  lowStock: { _id: string; name: string; stock: number; unit: string; salePrice: number }[]
  paymentMethods: { method: string; total: number; count: number }[]
  monthPaymentMethods: { method: string; total: number; count: number }[]
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous)
  if (pct === null) return null
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center text-[10px] font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch('/api/dashboard').then(r => {
      if (!r.ok) { toast.error('Dashboard yuklashda xato'); return }
      r.json().then(setData)
    })
  }, [])

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
        </div>
        <div className="h-72 bg-slate-200 rounded-xl" />
      </div>
    )
  }

  const todayStats = [
    { label: 'Bugungi sotuv', value: data.today.sales + ' ta', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Bugungi kirim', value: formatPrice(data.today.revenue), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Bugungi foyda', value: formatPrice(data.today.profit), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Bugungi xarajat', value: formatPrice(data.today.expenses), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Sof foyda (bugun)', value: formatPrice(data.today.netProfit), icon: DollarSign, color: data.today.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.today.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Umumiy qarz', value: formatPrice(data.totalDebt), icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Umumiy tovarlar', value: data.totalProducts + ' ta', icon: Package, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Ombor qiymati', value: formatPrice(data.warehouseValue), icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  ]

  const monthStats = [
    { label: 'Oylik sotuv', value: data.month.sales + ' ta', prev: data.lastMonth.sales, curr: data.month.sales },
    { label: 'Oylik kirim', value: formatPrice(data.month.revenue), prev: data.lastMonth.revenue, curr: data.month.revenue },
    { label: 'Oylik foyda', value: formatPrice(data.month.profit), prev: data.lastMonth.profit, curr: data.month.profit },
    { label: 'Sof foyda (oy)', value: formatPrice(data.month.netProfit), prev: data.lastMonth.netProfit, curr: data.month.netProfit },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      {/* Today stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3">
        {todayStats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
              </div>
              <div className="text-lg font-bold text-slate-800">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today payment methods */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { method: 'cash', label: 'Naqd', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
          { method: 'card', label: 'Karta', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
          { method: 'terminal', label: 'Terminal', icon: Smartphone, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ method, label, icon: Icon, color, bg }) => {
          const pm = data.paymentMethods.find(p => p.method === method)
          return (
            <Card key={method} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                  <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-800">{formatPrice(pm?.total || 0)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{pm?.count || 0} ta to&apos;lov</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Month stats with comparison */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {monthStats.map(({ label, value, prev, curr }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                <ChangeIndicator current={curr} previous={prev} />
              </div>
              <div className="text-lg font-bold text-slate-800">{value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">O&apos;tgan oy: {typeof prev === 'number' && prev > 999 ? formatPrice(prev) : prev}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Month payment methods */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { method: 'cash', label: 'Naqd (oy)', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
          { method: 'card', label: 'Karta (oy)', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
          { method: 'terminal', label: 'Terminal (oy)', icon: Smartphone, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ method, label, icon: Icon, color, bg }) => {
          const pm = data.monthPaymentMethods.find(p => p.method === method)
          return (
            <Card key={method} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                  <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-800">{formatPrice(pm?.total || 0)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{pm?.count || 0} ta to&apos;lov</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Chart: 30 days */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">
            So&apos;nggi 30 kun
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.chart}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v} />
              <Tooltip formatter={(v) => formatPrice(Number(v))} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#gRevenue)" name="Kirim" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#gProfit)" name="Foyda" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#gExpense)" name="Xarajat" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom row: top products + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products today */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              Bugungi top mahsulotlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.topProducts} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v} hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v) => typeof v === 'number' && v > 100 ? formatPrice(v) : v + ' ta'} />
                    <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Miqdor" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {data.topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{i + 1}. {p.name}</span>
                      <span className="font-medium text-slate-800">{p.qty} ta &middot; {formatPrice(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 py-8 text-sm">Bugun sotuv yo&apos;q</div>
            )}
          </CardContent>
        </Card>

        {/* Low stock alert */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Kam qolgan tovarlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStock.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.lowStock.map(p => (
                  <div key={p._id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">{formatPrice(p.salePrice)}/{p.unit}</div>
                    </div>
                    <div className={`text-sm font-bold ${p.stock <= 0 ? 'text-red-600' : p.stock <= 3 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {p.stock <= 0 ? 'Tugagan' : `${p.stock} ${p.unit}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8 text-sm">Barcha tovarlar yetarli</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
