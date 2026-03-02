'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { BookOpen, Search, CreditCard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'

interface Debt {
  _id: string
  customer: { _id: string; name: string; phone?: string }
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
  createdAt: string
  payments: { amount: number; date: string; note?: string }[]
}

export default function QarzlarPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [payDialog, setPayDialog] = useState(false)
  const [addDialog, setAddDialog] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [addForm, setAddForm] = useState({ customerName: '', customerPhone: '', amount: '', note: '' })

  const fetchDebts = useCallback(async () => {
    const res = await fetch(`/api/debts?status=${status}`)
    const data = await res.json()
    setDebts(Array.isArray(data) ? data : [])
  }, [status])

  useEffect(() => { fetchDebts() }, [fetchDebts])

  const filtered = debts.filter(d =>
    d.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.customer?.phone || '').includes(search)
  )

  const totalDebt = filtered.filter(d => d.status === 'active').reduce((s, d) => s + d.remainingAmount, 0)

  async function handleAdd() {
    if (!addForm.customerName.trim() || !addForm.amount) return toast.error('Ism va summa majburiy')
    const num = Number(addForm.amount)
    if (!num || num <= 0) return toast.error('Summa noto\'g\'ri')
    setLoading(true)
    const res = await fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: addForm.customerName.trim(), customerPhone: addForm.customerPhone.trim() || undefined, amount: num, note: addForm.note || undefined }),
    })
    setLoading(false)
    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success('Qarz qo\'shildi')
    setAddDialog(false)
    setAddForm({ customerName: '', customerPhone: '', amount: '', note: '' })
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
      body: JSON.stringify({ amount: num, note }),
    })
    setLoading(false)

    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success('To\'lov qabul qilindi')
    setPayDialog(false)
    setAmount('')
    setNote('')
    fetchDebts()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Qarz daftarcha</h1>
          {status === 'active' && filtered.length > 0 && (
            <p className="text-sm text-slate-500">Umumiy qarz: <span className="font-bold text-orange-600">{formatPrice(totalDebt)}</span></p>
          )}
        </div>
        <Button size="sm" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />Qarz qo&apos;shish
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Mijoz qidirish..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Faol qarzlar</SelectItem>
            <SelectItem value="paid">To&apos;langan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(d => (
          <Card key={d._id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{d.customer?.name}</div>
                    {d.customer?.phone && <div className="text-xs text-slate-400">{d.customer.phone}</div>}
                    <div className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString('uz-UZ')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={d.status === 'active' ? 'destructive' : 'secondary'} className="mb-1">
                    {d.status === 'active' ? 'Faol' : 'To\'langan'}
                  </Badge>
                  <div className="text-xs text-slate-500">Jami: {formatPrice(d.totalAmount)}</div>
                  <div className="text-xs text-slate-500">To&apos;langan: {formatPrice(d.paidAmount)}</div>
                  {d.status === 'active' && (
                    <div className="text-sm font-bold text-red-600">Qoldi: {formatPrice(d.remainingAmount)}</div>
                  )}
                </div>
              </div>

              {d.status === 'active' && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setSelectedDebt(d); setPayDialog(true) }}>
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    To&apos;lov qabul qilish
                  </Button>
                </div>
              )}

              {d.payments.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs text-slate-400 mb-1.5">To&apos;lov tarixi:</div>
                  <div className="space-y-1">
                    {d.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-500">{new Date(p.date).toLocaleDateString('uz-UZ')}</span>
                        <span className="font-medium text-green-600">{formatPrice(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12">Qarz topilmadi</div>
        )}
      </div>

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi qarz</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mijoz ismi *</Label>
              <Input value={addForm.customerName} onChange={e => setAddForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Ism familiya" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={addForm.customerPhone} onChange={e => setAddForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="+998 XX XXX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>Qarz summasi *</Label>
              <Input type="number" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} placeholder="Summa" />
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

      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Qarz to&apos;lovi</DialogTitle>
          </DialogHeader>
          {selectedDebt && (
            <div className="space-y-4">
              <div className="bg-orange-50 rounded-lg p-3 text-sm">
                <div className="font-medium">{selectedDebt.customer?.name}</div>
                <div className="text-orange-700 font-bold mt-1">
                  Qolgan qarz: {formatPrice(selectedDebt.remainingAmount)}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>To&apos;lov summasi</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Maks: ${selectedDebt.remainingAmount}`} />
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
