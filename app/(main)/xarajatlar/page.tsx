'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Settings2, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NumberInput } from '@/components/ui/NumberInput'
import { formatPrice } from '@/lib/utils'

interface ExpenseSource { _id: string; name: string; description?: string }
interface Expense { _id: string; source: { _id: string; name: string }; amount: number; description?: string; date: string }

export default function XarajatlarPage() {
  const [sources, setSources] = useState<ExpenseSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [sourceDialog, setSourceDialog] = useState(false)
  const [addDialog, setAddDialog] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', description: '' })
  const [form, setForm] = useState({ sourceId: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) })
  const [filterSource, setFilterSource] = useState('all')
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table')

  const fetchExpenses = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterSource !== 'all') params.set('source', filterSource)
    const res = await fetch(`/api/expenses?${params}`)
    if (!res.ok) return toast.error('Xarajatlarni yuklashda xato')
    setExpenses(await res.json())
  }, [filterSource])

  useEffect(() => {
    fetch('/api/expense-sources').then(r => {
      if (!r.ok) { toast.error('Manbalarni yuklashda xato'); return }
      r.json().then(setSources)
    })
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const totalBySource: Record<string, number> = {}
  for (const e of expenses) {
    const key = e.source?._id || 'other'
    totalBySource[key] = (totalBySource[key] || 0) + e.amount
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0)

  async function addSource() {
    if (!newSource.name.trim()) return
    const res = await fetch('/api/expense-sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSource),
    })
    if (!res.ok) return toast.error('Manba qo\'shishda xato')
    const src = await res.json()
    setSources(prev => [...prev, src])
    setNewSource({ name: '', description: '' })
    toast.success('Manba qo\'shildi')
  }

  async function deleteSource(id: string) {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/expense-sources/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    setSources(prev => prev.filter(s => s._id !== id))
    toast.success('O\'chirildi')
  }

  async function addExpense() {
    if (!form.sourceId || !form.amount) return toast.error('Manba va summa majburiy')
    setLoading(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: form.sourceId,
        amount: Number(form.amount),
        description: form.description || undefined,
        date: form.date,
      }),
    })
    setLoading(false)
    if (!res.ok) return toast.error('Xato')
    const expense = await res.json()
    setExpenses(prev => [expense, ...prev])
    setAddDialog(false)
    setForm({ sourceId: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) })
    toast.success('Xarajat qo\'shildi')
  }

  async function deleteExpense(id: string) {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    setExpenses(prev => prev.filter(e => e._id !== id))
    toast.success('O\'chirildi')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Xarajatlar</h1>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <button className={`p-1.5 ${viewMode === 'list' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('list')}>
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button className={`p-1.5 ${viewMode === 'table' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('table')}>
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSourceDialog(true)}>
            <Settings2 className="w-4 h-4 mr-1" />Manbalar
          </Button>
          <Button size="sm" onClick={() => setAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />Xarajat qo&apos;shish
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm col-span-2 md:col-span-1">
          <CardContent className="p-3">
            <div className="text-xs text-slate-500 mb-1">Jami xarajat</div>
            <div className="text-lg font-bold text-red-600">{formatPrice(grandTotal)}</div>
          </CardContent>
        </Card>
        {sources.slice(0, 3).map(s => (
          <Card key={s._id} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs text-slate-500 mb-1 truncate">{s.name}</div>
              <div className="text-base font-bold text-slate-800">{formatPrice(totalBySource[s._id] || 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Barcha manbalar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha manbalar</SelectItem>
            {sources.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Manba</th>
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium">Izoh</th>
                <th className="px-4 py-3 font-medium text-right">Summa</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e._id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.source?.name}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString('uz-UZ')}</td>
                  <td className="px-4 py-3 text-slate-500">{e.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatPrice(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteExpense(e._id)} className="p-1 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && (
            <div className="text-center text-slate-400 py-12">Xarajat topilmadi</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <Card key={e._id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{e.source?.name}</span>
                    <span className="text-xs text-slate-400">{new Date(e.date).toLocaleDateString('uz-UZ')}</span>
                  </div>
                  {e.description && <div className="text-xs text-slate-500 mt-0.5">{e.description}</div>}
                </div>
                <div className="text-red-600 font-bold text-sm">{formatPrice(e.amount)}</div>
                <button onClick={() => deleteExpense(e._id)} className="p-1 hover:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </CardContent>
            </Card>
          ))}
          {expenses.length === 0 && (
            <div className="text-center text-slate-400 py-12">Xarajat topilmadi</div>
          )}
        </div>
      )}

      {/* Source management dialog */}
      <Dialog open={sourceDialog} onOpenChange={setSourceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Xarajat manbalari</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Input placeholder="Manba nomi" value={newSource.name} onChange={e => setNewSource(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Izoh (ixtiyoriy)" value={newSource.description} onChange={e => setNewSource(p => ({ ...p, description: e.target.value }))} />
              <Button className="w-full" onClick={addSource}><Plus className="w-4 h-4 mr-1" />Qo&apos;shish</Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {sources.map(s => (
                <div key={s._id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    {s.description && <div className="text-xs text-slate-400">{s.description}</div>}
                  </div>
                  <button onClick={() => deleteSource(s._id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add expense dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Xarajat qo&apos;shish</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Manba *</Label>
              <Select value={form.sourceId} onValueChange={v => setForm(f => ({ ...f, sourceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  {sources.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Summa *</Label>
              <NumberInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} min={0} />
            </div>
            <div className="space-y-1.5">
              <Label>Sana</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={addExpense} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
