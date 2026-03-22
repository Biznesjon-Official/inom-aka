'use client'
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ShoppingCart, TrendingUp, TrendingDown, Wallet, DollarSign,
  Download, Loader2, Banknote, CreditCard, Smartphone,
  Package, AlertTriangle, BookOpen,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
  customerDebt: number
  personalDebt: number
  totalProducts: number
  warehouseValue: number
  lowStock: { _id: string; name: string; stock: number; unit: string; salePrice: number }[]
}

type PresetKey = 'today' | 'week' | 'month' | 'year' | 'custom'

function getPresetDates(key: PresetKey): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  switch (key) {
    case 'today': return { from: fmt(now), to: fmt(now) }
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      return { from: fmt(start), to: fmt(now) }
    }
    case 'month': return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) }
    case 'year': return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) }
    default: return { from: fmt(now), to: fmt(now) }
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Bugun' },
  { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Oy' },
  { key: 'year', label: 'Yil' },
  { key: 'custom', label: 'Tanlash' },
]

export default function DashboardPage() {
  const [activePreset, setActivePreset] = useState<PresetKey>('today')
  const [from, setFrom] = useState(() => getPresetDates('today').from)
  const [to, setTo] = useState(() => getPresetDates('today').to)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?from=${f}&to=${t}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Yuklashda xato')
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key)
    if (key !== 'custom') {
      const { from: f, to: t } = getPresetDates(key)
      setFrom(f); setTo(t)
      fetchReport(f, t)
    }
  }

  useEffect(() => { fetchReport(from, to) }, [from, to, fetchReport])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchReport(from, to)
    }, 10000) // 10 seconds
    return () => clearInterval(interval)
  }, [from, to, fetchReport])

  const exportCSV = () => {
    if (!data) return
    const lines: string[] = []
    lines.push('Dashboard hisobot')
    lines.push(`Davr,${from},${to}`)
    lines.push(`Sotuv soni,${data.salesCount}`)
    lines.push(`Jami kirim,${data.totalRevenue}`)
    lines.push(`Foyda,${data.totalProfit}`)
    lines.push(`Xarajat,${data.totalExpenses}`)
    lines.push(`Sof foyda,${data.netProfit}`)
    lines.push('')
    lines.push('Kunlik,Sotuv,Kirim,Foyda,Xarajat')
    data.daily.forEach(d => lines.push(`${d.date},${d.sales},${d.revenue},${d.profit},${d.expense}`))
    lines.push('')
    lines.push('Mahsulot,Soni,Summa')
    data.topProducts.forEach(p => lines.push(`"${p.name}",${p.qty},${p.revenue}`))
    lines.push('')
    lines.push('Kassir,Sotuv soni,Summa')
    data.cashierStats.forEach(c => lines.push(`"${c.name}",${c.salesCount},${c.totalAmount}`))
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `hisobot_${from}_${to}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV yuklandi')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchReport(from, to)} disabled={loading}>
            <Loader2 className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : 'hidden'}`} />
            Yangilash
          </Button>
          {data && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1.5" />CSV
            </Button>
          )}
        </div>
      </div>

      {/* Date filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map(({ key, label }) => (
              <Button key={key} variant={activePreset === key ? 'default' : 'outline'} size="sm"
                onClick={() => handlePreset(key)}>
                {label}
              </Button>
            ))}
          </div>
          {activePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
              <span className="text-slate-400">—</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
              <Button size="sm" onClick={() => { if (!from || !to) return; fetchReport(from, to) }}>Ko&apos;rsatish</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stats: filterlangan */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Sotuv soni', value: data.salesCount + ' ta', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
              { label: 'Kirim', value: formatPrice(data.totalRevenue), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
              { label: 'Foyda', value: formatPrice(data.totalProfit), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Xarajat', value: formatPrice(data.totalExpenses), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Sof foyda', value: formatPrice(data.netProfit), icon: DollarSign, color: 'text-violet-500', bg: 'bg-violet-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                    <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info cards: joriy holat (date filterlangan emas) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">Mijoz qarzlari</span>
                  <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                </div>
                <div className="text-lg font-bold text-orange-600">{formatPrice(data.customerDebt)}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">Shaxsiy qarzlar</span>
                  <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-red-500" />
                  </div>
                </div>
                <div className="text-lg font-bold text-red-600">{formatPrice(data.personalDebt)}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">Tovarlar</span>
                  <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{data.totalProducts} ta</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">Ombor qiymati</span>
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatPrice(data.warehouseValue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { method: 'cash', label: 'Naqd', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
              { method: 'card', label: 'Karta', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
              { method: 'terminal', label: 'Terminal', icon: Smartphone, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(({ method, label, icon: Icon, color, bg }) => {
              const pm = data.paymentMethods.find(p => p.method === method)
              return (
                <Card key={method} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500 font-medium">{label}</span>
                      <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                    </div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatPrice(pm?.total || 0)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{pm?.count || 0} ta</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Chart */}
          {data.daily.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kunlik ko&apos;rsatkich</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.daily}>
                    <defs>
                      <linearGradient id="dColorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dColorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dColorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000000).toFixed(1) + 'M'} />
                    <Tooltip formatter={(v) => formatPrice(Number(v))} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#dColorRevenue)" name="Kirim" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#dColorProfit)" name="Foyda" strokeWidth={2} />
                    <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#dColorExpense)" name="Xarajat" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top products + Cashier stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.topProducts.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Top 10 mahsulot</CardTitle>
                </CardHeader>
                <CardContent>
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
                        <tr key={p.name} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 text-slate-400">{i + 1}</td>
                          <td className="py-1.5 font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">{p.name}</td>
                          <td className="py-1.5 text-right text-slate-600">{p.qty}</td>
                          <td className="py-1.5 text-right text-slate-600">{formatPrice(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {data.cashierStats.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kassirlar</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 font-medium">Kassir</th>
                        <th className="pb-2 font-medium text-right">Sotuv</th>
                        <th className="pb-2 font-medium text-right">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cashierStats.map(c => (
                        <tr key={c.name} className="border-b border-slate-100 last:border-0">
                          <td className="py-1.5 font-medium text-slate-700 dark:text-slate-200">{c.name}</td>
                          <td className="py-1.5 text-right text-slate-600">{c.salesCount}</td>
                          <td className="py-1.5 text-right text-slate-600">{formatPrice(c.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Low stock */}
          {data.lowStock.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Kam stok ({data.lowStock.length} ta)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {data.lowStock.map(p => (
                    <div key={p._id} className="bg-amber-50 rounded-lg p-2.5">
                      <div className="text-xs font-medium text-slate-700 truncate">{p.name}</div>
                      <div className="text-sm font-bold text-amber-600 mt-0.5">
                        {p.stock} {p.unit} qoldi
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
