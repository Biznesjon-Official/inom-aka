'use client'
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ShoppingCart, TrendingUp, TrendingDown, Wallet, DollarSign,
  Download, Calendar, Loader2, Banknote, CreditCard, Smartphone,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { formatPrice } from '@/lib/utils'

interface ReportData {
  salesCount: number
  totalRevenue: number
  totalProfit: number
  totalExpenses: number
  netProfit: number
  newDebt: number
  paidDebt: number
  daily: { date: string; revenue: number; profit: number; expense: number; sales: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  cashierStats: { name: string; salesCount: number; totalAmount: number }[]
  paymentMethods: { method: string; total: number; count: number }[]
}

type PresetKey = 'today' | 'week' | 'month' | 'year' | 'custom'

function getPresetDates(key: PresetKey): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  switch (key) {
    case 'today':
      return { from: fmt(now), to: fmt(now) }
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      return { from: fmt(start), to: fmt(now) }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmt(start), to: fmt(now) }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { from: fmt(start), to: fmt(now) }
    }
    default:
      return { from: fmt(now), to: fmt(now) }
  }
}

const presets: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Bugun' },
  { key: 'week', label: 'Bu hafta' },
  { key: 'month', label: 'Bu oy' },
  { key: 'year', label: 'Bu yil' },
  { key: 'custom', label: 'Tanlash' },
]

export default function HisobotPage() {
  const [activePreset, setActivePreset] = useState<PresetKey>('month')
  const [from, setFrom] = useState(() => getPresetDates('month').from)
  const [to, setTo] = useState(() => getPresetDates('month').to)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?from=${f}&to=${t}`)
      if (!res.ok) throw new Error('Hisobot yuklashda xato')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Hisobot yuklashda xato')
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key)
    if (key !== 'custom') {
      const { from: f, to: t } = getPresetDates(key)
      setFrom(f)
      setTo(t)
      fetchReport(f, t)
    }
  }

  const handleCustomSearch = () => {
    if (!from || !to) { toast.error('Sanalarni tanlang'); return }
    fetchReport(from, to)
  }

  // CSV export
  const exportCSV = () => {
    if (!data) return
    const lines: string[] = []

    // Summary
    lines.push('Hisobot')
    lines.push(`Davr,${from},${to}`)
    lines.push(`Sotuv soni,${data.salesCount}`)
    lines.push(`Jami kirim,${data.totalRevenue}`)
    lines.push(`Foyda,${data.totalProfit}`)
    lines.push(`Xarajat,${data.totalExpenses}`)
    lines.push(`Sof foyda,${data.netProfit}`)
    lines.push('')

    // Daily
    lines.push('Kunlik,Sotuv,Kirim,Foyda,Xarajat')
    data.daily.forEach(d => {
      lines.push(`${d.date},${d.sales},${d.revenue},${d.profit},${d.expense}`)
    })
    lines.push('')

    // Top products
    lines.push('Mahsulot,Soni,Summa')
    data.topProducts.forEach(p => {
      lines.push(`"${p.name}",${p.qty},${p.revenue}`)
    })
    lines.push('')

    // Cashiers
    lines.push('Kassir,Sotuv soni,Summa')
    data.cashierStats.forEach(c => {
      lines.push(`"${c.name}",${c.salesCount},${c.totalAmount}`)
    })

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hisobot_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV yuklandi')
  }

  // Load initial data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReport(from, to) }, [])

  const stats = data ? [
    { label: 'Sotuv soni', value: data.salesCount + ' ta', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Jami kirim', value: formatPrice(data.totalRevenue), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Foyda', value: formatPrice(data.totalProfit), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Xarajat', value: formatPrice(data.totalExpenses), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Sof foyda', value: formatPrice(data.netProfit), icon: DollarSign, color: 'text-violet-500', bg: 'bg-violet-50' },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Hisobot</h1>
        {data && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV yuklash
          </Button>
        )}
      </div>

      {/* Date filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {presets.map(({ key, label }) => (
              <Button
                key={key}
                variant={activePreset === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePreset(key)}
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                {label}
              </Button>
            ))}
          </div>
          {activePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-slate-400">—</span>
              <Input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-40"
              />
              <Button size="sm" onClick={handleCustomSearch}>Ko&apos;rsatish</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stats cards */}
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
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { method: 'cash', label: 'Naqd', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
              { method: 'card', label: 'Karta', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
              { method: 'terminal', label: 'Terminal', icon: Smartphone, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(({ method, label, icon: Icon, color, bg }) => {
              const pm = data.paymentMethods.find(p => p.method === method)
              return (
                <Card key={method} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-slate-500 font-medium">{label}</span>
                      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatPrice(pm?.total || 0)}</div>
                    <div className="text-xs text-slate-400 mt-1">{pm?.count || 0} ta to&apos;lov</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Debt info */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500 font-medium">Yangi qarz</span>
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-orange-500" />
                  </div>
                </div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatPrice(data.newDebt)}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500 font-medium">To&apos;langan qarz</span>
                  <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-teal-500" />
                  </div>
                </div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatPrice(data.paidDebt)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {data.daily.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  Kunlik kirim va foyda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.daily}>
                    <defs>
                      <linearGradient id="rColorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rColorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} />
                    <Tooltip formatter={(v) => formatPrice(Number(v))} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#rColorRevenue)" name="Kirim" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#rColorProfit)" name="Foyda" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top 10 products */}
          {data.topProducts.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  Top 10 mahsulot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 font-medium">#</th>
                        <th className="pb-2 font-medium">Mahsulot</th>
                        <th className="pb-2 font-medium text-right">Soni</th>
                        <th className="pb-2 font-medium text-right">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={p.name} className="border-b border-slate-100">
                          <td className="py-2 text-slate-400">{i + 1}</td>
                          <td className="py-2 font-medium text-slate-700 dark:text-slate-200">{p.name}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{p.qty}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatPrice(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cashier stats */}
          {data.cashierStats.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  Kassirlar statistikasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 font-medium">Kassir</th>
                        <th className="pb-2 font-medium text-right">Sotuv soni</th>
                        <th className="pb-2 font-medium text-right">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cashierStats.map(c => (
                        <tr key={c.name} className="border-b border-slate-100">
                          <td className="py-2 font-medium text-slate-700 dark:text-slate-200">{c.name}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{c.salesCount}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatPrice(c.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
