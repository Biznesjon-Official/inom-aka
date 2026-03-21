'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, CreditCard, Plus, List, LayoutGrid, Trash2, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'
import { NumberInput } from '@/components/ui/NumberInput'

interface DebtCategory { _id: string; name: string; description?: string }
interface SaleItem {
  productName: string
  qty: number
  salePrice: number
  unit: string
}
interface Debt {
  _id: string
  customer?: { _id: string; name: string; phone?: string }
  customerName?: string
  customerPhone?: string
  category?: DebtCategory
  sale?: { _id: string; total: number; paid: number; items: SaleItem[] } | null
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
  note?: string
  createdAt: string
  payments: { amount: number; date: string; note?: string }[]
}

export default function QarzlarPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [categories, setCategories] = useState<DebtCategory[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [filterCategory, setFilterCategory] = useState('all')
  const [payDialog, setPayDialog] = useState(false)
  const [addDialog, setAddDialog] = useState(false)
  const [catDialog, setCatDialog] = useState(false)
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [amount, setAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'terminal'>('cash')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [addForm, setAddForm] = useState({ customerName: '', customerPhone: '', amount: '', note: '', categoryId: '' })
  const [newCat, setNewCat] = useState({ name: '', description: '' })

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/debt-categories?scope=customer')
    if (res.ok) setCategories(await res.json())
  }, [])

  const fetchDebts = useCallback(async () => {
    const params = new URLSearchParams({ status })
    if (filterCategory !== 'all') params.set('category', filterCategory)
    const res = await fetch(`/api/debts?${params}`)
    if (!res.ok) return toast.error('Qarzlarni yuklashda xato')
    const data = await res.json()
    setDebts(Array.isArray(data) ? data : [])
  }, [status, filterCategory])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { fetchDebts() }, [fetchDebts])

  const debtorName = (d: Debt) => d.customerName || d.customer?.name || ''
  const debtorPhone = (d: Debt) => d.customerPhone || d.customer?.phone || ''

  const filtered = debts.filter(d =>
    debtorName(d).toLowerCase().includes(search.toLowerCase()) ||
    debtorPhone(d).includes(search)
  )

  const totalDebt = filtered.filter(d => d.status === 'active').reduce((s, d) => s + d.remainingAmount, 0)

  const totalByCategory: Record<string, number> = {}
  for (const d of filtered.filter(x => x.status === 'active')) {
    const key = d.category?._id || 'other'
    totalByCategory[key] = (totalByCategory[key] || 0) + d.remainingAmount
  }

  async function addCategory() {
    if (!newCat.name.trim()) return
    const res = await fetch('/api/debt-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCat, scope: 'customer' }),
    })
    if (!res.ok) return toast.error('Xato')
    const cat = await res.json()
    setCategories(prev => [...prev, cat])
    setNewCat({ name: '', description: '' })
    toast.success('Kategoriya qo\'shildi')
  }

  async function deleteCategory(id: string) {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/debt-categories/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('Xato')
    setCategories(prev => prev.filter(c => c._id !== id))
    toast.success('O\'chirildi')
  }

  async function handleAdd() {
    if (!addForm.customerName.trim() || !addForm.amount) return toast.error('Ism va summa majburiy')
    const num = Number(addForm.amount)
    if (!num || num <= 0) return toast.error('Summa noto\'g\'ri')
    setLoading(true)
    const res = await fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: addForm.customerName.trim(),
        customerPhone: addForm.customerPhone.trim() || undefined,
        amount: num,
        note: addForm.note || undefined,
        category: addForm.categoryId || undefined,
      }),
    })
    setLoading(false)
    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success('Qarz qo\'shildi')
    setAddDialog(false)
    setAddForm({ customerName: '', customerPhone: '', amount: '', note: '', categoryId: '' })
    fetchDebts()
  }

  async function handlePay() {
    if (!selectedDebt) return
    const num = Number(amount)
    if (!num || num <= 0) return toast.error('Summa noto\'g\'ri')
    if (num > selectedDebt.remainingAmount) return toast.error('Qarz miqdoridan ko\'p')
    setLoading(true)
    const res = await fetch(`/api/debts/${selectedDebt._id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: num, method: payMethod, note }),
    })
    setLoading(false)
    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success('To\'lov qabul qilindi')
    setPayDialog(false)
    setAmount('')
    setNote('')
    setPayMethod('cash')
    fetchDebts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Qarzni o\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    toast.success('O\'chirildi')
    fetchDebts()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Qarz daftarcha</h1>
          {status === 'active' && totalDebt > 0 && (
            <p className="text-sm text-slate-500">Umumiy qarz: <span className="font-bold text-orange-600">{formatPrice(totalDebt)}</span></p>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <button className={`p-1.5 ${viewMode === 'card' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('card')}>
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button className={`p-1.5 ${viewMode === 'table' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('table')}>
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCatDialog(true)}>
            <Settings2 className="w-4 h-4 mr-1" />Kategoriyalar
          </Button>
          <Button size="sm" onClick={() => setAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />Qarz qo&apos;shish
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {status === 'active' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm col-span-2 md:col-span-1">
            <CardContent className="p-3">
              <div className="text-xs text-slate-500 mb-1">Jami qarz</div>
              <div className="text-lg font-bold text-orange-600">{formatPrice(totalDebt)}</div>
            </CardContent>
          </Card>
          {categories.slice(0, 3).map(c => (
            <Card key={c._id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="text-xs text-slate-500 mb-1 truncate">{c.name}</div>
                <div className="text-base font-bold text-slate-800">{formatPrice(totalByCategory[c._id] || 0)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${status === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setStatus('active')}>
          Faol qarzlar
        </button>
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${status === 'paid' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setStatus('paid')}>
          Arxiv
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Qidirish..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Barcha kategoriya" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha kategoriya</SelectItem>
            {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table view */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Qarzdor</th>
                <th className="px-4 py-3 font-medium">Kategoriya</th>
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium text-right">Jami</th>
                <th className="px-4 py-3 font-medium text-right">To&apos;langan</th>
                <th className="px-4 py-3 font-medium text-right">Qoldi</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <React.Fragment key={d._id}>
                <tr className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedDebt(expandedDebt === d._id ? null : d._id)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{debtorName(d)}</div>
                    {debtorPhone(d) && <div className="text-xs text-slate-400">{debtorPhone(d)}</div>}
                    {d.note && <div className="text-xs text-slate-400 italic">{d.note}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.sale && <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">Kassadan</Badge>}
                      {d.category ? <Badge variant="secondary" className="text-xs">{d.category.name}</Badge> : null}
                      {!d.sale && !d.category && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString('uz-UZ')}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatPrice(d.totalAmount)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatPrice(d.paidAmount)}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    {d.status === 'active' ? <span className="text-red-600">{formatPrice(d.remainingAmount)}</span> : <span className="text-slate-400 font-normal">To&apos;langan</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      {d.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => { setSelectedDebt(d); setPayDialog(true) }}>
                          <CreditCard className="w-3.5 h-3.5 mr-1" />To&apos;lov
                        </Button>
                      )}
                      <button onClick={() => handleDelete(d._id)} className="p-1.5 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedDebt === d._id && (
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="px-4 py-3">
                      {d.sale && d.sale.items && d.sale.items.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-slate-500 mb-1">Sotib olingan tovarlar:</div>
                          {d.sale.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-slate-600">{item.productName} x{item.qty} {item.unit}</span>
                              <span className="text-slate-700 font-medium">{formatPrice(item.salePrice * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Bu qarz to&apos;g&apos;ridan-to&apos;g&apos;ri qo&apos;shilgan (tovar ma&apos;lumoti yo&apos;q)</div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center text-slate-400 py-12">Qarz topilmadi</div>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <Card key={d._id} className="border-0 shadow-sm cursor-pointer"
              onClick={() => setExpandedDebt(expandedDebt === d._id ? null : d._id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-800">{debtorName(d)}</div>
                    {debtorPhone(d) && <div className="text-xs text-slate-400">{debtorPhone(d)}</div>}
                    <div className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString('uz-UZ')}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {d.sale && <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">Kassadan</Badge>}
                      {d.category && <Badge variant="secondary" className="text-xs">{d.category.name}</Badge>}
                    </div>
                    {d.note && <div className="text-xs text-slate-400 italic mt-0.5">{d.note}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-500">Jami: {formatPrice(d.totalAmount)}</div>
                    <div className="text-xs text-slate-500">To&apos;langan: {formatPrice(d.paidAmount)}</div>
                    {d.status === 'active'
                      ? <div className="text-sm font-bold text-red-600">Qoldi: {formatPrice(d.remainingAmount)}</div>
                      : <Badge variant="secondary">To&apos;langan</Badge>
                    }
                  </div>
                </div>
                {expandedDebt === d._id && (
                  <div className="mt-3 border-t pt-2">
                    {d.sale && d.sale.items && d.sale.items.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-500 mb-1">Sotib olingan tovarlar:</div>
                        {d.sale.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-600">{item.productName} x{item.qty} {item.unit}</span>
                            <span className="text-slate-700 font-medium">{formatPrice(item.salePrice * item.qty)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Bu qarz to&apos;g&apos;ridan-to&apos;g&apos;ri qo&apos;shilgan (tovar ma&apos;lumoti yo&apos;q)</div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleDelete(d._id)} className="p-1.5 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                  {d.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedDebt(d); setPayDialog(true) }}>
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" />To&apos;lov qabul qilish
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <div className="text-center text-slate-400 py-12">Qarz topilmadi</div>}
        </div>
      )}

      {/* Category management dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Qarz kategoriyalari</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Input placeholder="Kategoriya nomi" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <Input placeholder="Izoh (ixtiyoriy)" value={newCat.description} onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))} />
              <Button className="w-full" onClick={addCategory}><Plus className="w-4 h-4 mr-1" />Qo&apos;shish</Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categories.map(c => (
                <div key={c._id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    {c.description && <div className="text-xs text-slate-400">{c.description}</div>}
                  </div>
                  <button onClick={() => deleteCategory(c._id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
              {categories.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Kategoriya yo&apos;q</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add debt dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Yangi qarz</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Qarzdor ismi *</Label>
              <Input value={addForm.customerName} onChange={e => setAddForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Ism familiya" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={addForm.customerPhone} onChange={e => setAddForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="+998 XX XXX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>Kategoriya</Label>
              <Select value={addForm.categoryId || 'none'} onValueChange={v => setAddForm(f => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang (ixtiyoriy)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kategoriyasiz</SelectItem>
                  {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Qarz summasi *</Label>
              <NumberInput value={addForm.amount} onChange={v => setAddForm(f => ({ ...f, amount: v }))} placeholder="Summa" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input value={addForm.note} onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))} placeholder="Ixtiyoriy" />
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payDialog} onOpenChange={v => { setPayDialog(v); if (!v) { setAmount(''); setNote(''); setPayMethod('cash'); setSelectedDebt(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Qarz to&apos;lovi</DialogTitle></DialogHeader>
          {selectedDebt && (
            <div className="space-y-4">
              <div className="bg-orange-50 rounded-lg p-3 text-sm">
                <div className="font-medium">{debtorName(selectedDebt)}</div>
                <div className="text-orange-700 font-bold mt-1">Qolgan qarz: {formatPrice(selectedDebt.remainingAmount)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>To&apos;lov usuli</Label>
                <div className="flex gap-2">
                  {([['cash', '💵 Naqd'], ['card', '💳 Karta'], ['terminal', '📱 Terminal']] as const).map(([m, label]) => (
                    <button key={m} type="button"
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${payMethod === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      onClick={() => setPayMethod(m)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>To&apos;lov summasi</Label>
                <NumberInput value={amount} onChange={setAmount} placeholder={`Maks: ${selectedDebt.remainingAmount}`} min={0} max={selectedDebt.remainingAmount} />
              </div>
              <div className="space-y-1.5">
                <Label>Izoh (ixtiyoriy)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handlePay} disabled={loading}>
                {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
