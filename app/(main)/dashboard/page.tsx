'use client'
import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ShoppingCart, TrendingUp, TrendingDown, Wallet, DollarSign,
  Download, Loader2, Banknote, CreditCard, Smartphone,
  Package, BookOpen,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface ReportData {
  salesCount: number
  salesRevenue: number
  debtRevenue: number
  totalRevenue: number
  totalProfit: number
  totalExpenses: number
  netProfit: number
  newDebt: number
  paidDebt: number
  daily: { date: string; revenue: number; profit: number; expense: number; sales: number }[]
  cashierStats: { name: string; salesCount: number; totalAmount: number }[]
  paymentMethods: { method: string; total: number; count: number }[]
  customerDebt: number
  personalDebt: number
  totalProducts: number
  warehouseValue: number
}

type PresetKey = 'today' | 'week' | 'month' | 'year' | 'custom'

function getPresetDates(key: PresetKey): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
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
  const [detailCard, setDetailCard] = useState<string | null>(null)

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
    }
  }

  useEffect(() => { fetchReport(from, to) }, [from, to, fetchReport])


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
              <Button size="sm" onClick={() => { if (!from || !to || from > to) { toast.error('Sana noto\'g\'ri'); return }; fetchReport(from, to) }}>Ko&apos;rsatish</Button>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: 'sales', label: 'Sotuv soni', value: data.salesCount + ' ta', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
              { key: 'salesRevenue', label: 'Sotuvdan kirim', value: formatPrice(data.salesRevenue), icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
              { key: 'debtRevenue', label: 'Qarzdan kirim', value: formatPrice(data.debtRevenue), icon: TrendingUp, color: 'text-teal-500', bg: 'bg-teal-50' },
              { key: 'revenue', label: 'Umumiy kirim', value: formatPrice(data.totalRevenue), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { key: 'profit', label: 'Foyda', value: formatPrice(data.totalProfit), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { key: 'expense', label: 'Xarajat', value: formatPrice(data.totalExpenses), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
              { key: 'net', label: 'Sof foyda', value: formatPrice(data.netProfit), icon: DollarSign, color: 'text-violet-500', bg: 'bg-violet-50' },
            ].map(({ key, label, value, icon: Icon, color, bg }) => (
              <Card key={key} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailCard(key)}>
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

          {/* Qarz ko'rsatkichlari */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">Yangi qarz</span>
                  <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                </div>
                <div className="text-lg font-bold text-orange-600">{formatPrice(data.newDebt)}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500 font-medium">Qarz to&apos;lovi</span>
                  <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                    <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                  </div>
                </div>
                <div className="text-lg font-bold text-green-600">{formatPrice(data.paidDebt)}</div>
              </CardContent>
            </Card>
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

          {/* Kassirlar */}
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
        </>
      )}

      {/* Detail dialog */}
      {data && (
        <Dialog open={!!detailCard} onOpenChange={v => { if (!v) setDetailCard(null) }}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">
                {detailCard === 'sales' && 'Sotuv tafsiloti'}
                {detailCard === 'salesRevenue' && 'Sotuvdan kirim'}
                {detailCard === 'debtRevenue' && 'Qarzdan kirim'}
                {detailCard === 'revenue' && 'Umumiy kirim tafsiloti'}
                {detailCard === 'profit' && 'Foyda tafsiloti'}
                {detailCard === 'expense' && 'Xarajat tafsiloti'}
                {detailCard === 'net' && 'Sof foyda tafsiloti'}
              </DialogTitle>
            </DialogHeader>

            {detailCard === 'sales' && (
              <div className="space-y-3">
                <div className="text-sm text-slate-500">Jami: <span className="font-bold text-slate-800">{data.salesCount} ta</span></div>
                {data.cashierStats.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Kassirlar bo&apos;yicha:</div>
                    {data.cashierStats.map(c => (
                      <div key={c.name} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-700">{c.name}</span>
                        <span className="text-slate-500">{c.salesCount} ta — {formatPrice(c.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {data.daily.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Kunlik:</div>
                    {data.daily.map(d => (
                      <div key={d.date} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600">{d.date}</span>
                        <span className="text-slate-500">{d.sales} ta sotuv</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailCard === 'salesRevenue' && (
              <div className="space-y-2 text-sm">
                <div className="text-slate-500">Faqat sotuvlardan tushgan pul (qarz to&apos;lovlarsiz)</div>
                <div className="font-bold text-green-700 text-lg">{formatPrice(data.salesRevenue)}</div>
              </div>
            )}

            {detailCard === 'debtRevenue' && (
              <div className="space-y-2 text-sm">
                <div className="text-slate-500">Sotuvga bog&apos;liq bo&apos;lmagan qarzlar bo&apos;yicha to&apos;lovlar</div>
                <div className="font-bold text-teal-700 text-lg">{formatPrice(data.debtRevenue)}</div>
              </div>
            )}

            {detailCard === 'revenue' && (
              <div className="space-y-3">
                <div className="text-sm text-slate-500">Jami kirim: <span className="font-bold text-green-700">{formatPrice(data.totalRevenue)}</span></div>
                {data.paymentMethods.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">To&apos;lov usullari:</div>
                    {data.paymentMethods.map(p => (
                      <div key={p.method} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-slate-700">{p.method === 'cash' ? 'Naqd' : p.method === 'card' ? 'Karta' : 'Terminal'}</span>
                        <span className="font-medium text-slate-800">{formatPrice(p.total)} <span className="text-slate-400 font-normal">({p.count} ta)</span></span>
                      </div>
                    ))}
                  </div>
                )}
                {data.daily.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Kunlik kirim:</div>
                    {data.daily.map(d => (
                      <div key={d.date} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600">{d.date}</span>
                        <span className="text-green-700 font-medium">{formatPrice(d.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailCard === 'profit' && (
              <div className="space-y-3">
                <div className="text-sm text-slate-500">Jami foyda: <span className="font-bold text-emerald-700">{formatPrice(data.totalProfit)}</span></div>
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Sotuvdan kirim:</span><span className="text-slate-700">{formatPrice(data.salesRevenue)}</span></div>
                  <div className="flex justify-between"><span>Tan narx (taxminiy):</span><span className="text-slate-700">{formatPrice(data.salesRevenue - data.totalProfit)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-medium"><span>Foyda:</span><span className="text-emerald-700">{formatPrice(data.totalProfit)}</span></div>
                </div>
                {data.daily.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Kunlik foyda:</div>
                    {data.daily.map(d => (
                      <div key={d.date} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600">{d.date}</span>
                        <span className="text-emerald-700 font-medium">{formatPrice(d.profit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailCard === 'expense' && (
              <div className="space-y-3">
                <div className="text-sm text-slate-500">Jami xarajat: <span className="font-bold text-red-600">{formatPrice(data.totalExpenses)}</span></div>
                {data.daily.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Kunlik xarajat:</div>
                    {data.daily.filter(d => d.expense > 0).map(d => (
                      <div key={d.date} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600">{d.date}</span>
                        <span className="text-red-600 font-medium">{formatPrice(d.expense)}</span>
                      </div>
                    ))}
                    {data.daily.every(d => d.expense === 0) && (
                      <div className="text-xs text-slate-400 text-center py-2">Xarajat yo&apos;q</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {detailCard === 'net' && (
              <div className="space-y-3">
                <div className="text-sm text-slate-500">Sof foyda: <span className={`font-bold ${data.netProfit >= 0 ? 'text-violet-700' : 'text-red-600'}`}>{formatPrice(data.netProfit)}</span></div>
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Foyda:</span><span className="text-emerald-700">{formatPrice(data.totalProfit)}</span></div>
                  <div className="flex justify-between"><span>Xarajat:</span><span className="text-red-600">-{formatPrice(data.totalExpenses)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-medium"><span>Sof foyda:</span><span className={data.netProfit >= 0 ? 'text-violet-700' : 'text-red-600'}>{formatPrice(data.netProfit)}</span></div>
                </div>
                {data.daily.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Kunlik sof foyda:</div>
                    {data.daily.map(d => {
                      const net = d.profit - d.expense
                      return (
                        <div key={d.date} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                          <span className="text-slate-600">{d.date}</span>
                          <span className={`font-medium ${net >= 0 ? 'text-violet-700' : 'text-red-600'}`}>{formatPrice(net)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
