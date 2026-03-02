'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, UserCog, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'

interface Worker {
  _id: string; name: string; username: string; isActive: boolean
  salary: { fixed: number; salesPercent: number }
}

const emptyForm = { name: '', username: '', password: '', fixed: '', salesPercent: '' }

export default function IshchilarPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [dialog, setDialog] = useState(false)
  const [statsDialog, setStatsDialog] = useState(false)
  const [editing, setEditing] = useState<Worker | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [stats, setStats] = useState<{ today: { count: number; total: number; profit: number }; month: { count: number; total: number; profit: number } } | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchWorkers = useCallback(async () => {
    const res = await fetch('/api/workers')
    setWorkers(await res.json())
  }, [])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  async function openStats(id: string) {
    setSelectedWorker(id)
    const res = await fetch(`/api/workers/${id}`)
    const data = await res.json()
    setStats({ today: data.today, month: data.month })
    setStatsDialog(true)
  }

  function openAdd() { setEditing(null); setForm(emptyForm); setDialog(true) }
  function openEdit(w: Worker) {
    setEditing(w)
    setForm({ name: w.name, username: w.username, password: '', fixed: w.salary.fixed.toString(), salesPercent: w.salary.salesPercent.toString() })
    setDialog(true)
  }

  async function handleSave() {
    if (!form.name || !form.username) return toast.error('Ism va login majburiy')
    if (!editing && !form.password) return toast.error('Yangi ishchi uchun parol majburiy')
    setLoading(true)
    const body = {
      name: form.name,
      username: form.username,
      password: form.password || undefined,
      salary: { fixed: Number(form.fixed) || 0, salesPercent: Number(form.salesPercent) || 0 },
    }
    const url = editing ? `/api/workers/${editing._id}` : '/api/workers'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setLoading(false)
    if (!res.ok) return toast.error('Xato (login band bo\'lishi mumkin)')
    toast.success(editing ? 'Yangilandi' : 'Ishchi qo\'shildi')
    setDialog(false)
    fetchWorkers()
  }

  async function toggleActive(w: Worker) {
    await fetch(`/api/workers/${w._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !w.isActive }),
    })
    fetchWorkers()
  }

  const calcSalary = (w: Worker, profit: number) =>
    w.salary.fixed + Math.round(profit * w.salary.salesPercent / 100)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Ishchilar</h1>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Qo&apos;shish</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {workers.map(w => (
          <Card key={w._id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <UserCog className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{w.name}</div>
                    <div className="text-xs text-slate-400">@{w.username}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openEdit(w)}>
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button className="p-1 hover:bg-blue-50 rounded" onClick={() => openStats(w._id)}>
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <div className="text-xs text-slate-500">
                  Maosh: <span className="font-medium text-slate-700">{formatPrice(w.salary.fixed)}</span>
                  {w.salary.salesPercent > 0 && (
                    <span className="ml-1">+ {w.salary.salesPercent}% foyda</span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Badge variant={w.isActive ? 'default' : 'secondary'}>
                  {w.isActive ? 'Faol' : 'Nofaol'}
                </Badge>
                <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => toggleActive(w)}>
                  {w.isActive ? 'O\'chirish' : 'Faollashtirish'}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {workers.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12">Ishchi topilmadi</div>
        )}
      </div>

      {/* Worker form dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Tahrirlash' : 'Yangi ishchi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Login *</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{editing ? 'Yangi parol (bo\'sh qoldirsangiz o\'zgarmaydi)' : 'Parol *'}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sobit maosh (so&apos;m)</Label>
                <Input type="number" value={form.fixed} onChange={e => setForm(f => ({ ...f, fixed: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Foydadan % </Label>
                <Input type="number" value={form.salesPercent} onChange={e => setForm(f => ({ ...f, salesPercent: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats dialog */}
      <Dialog open={statsDialog} onOpenChange={setStatsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Statistika</DialogTitle>
          </DialogHeader>
          {stats && selectedWorker && (() => {
            const w = workers.find(x => x._id === selectedWorker)
            if (!w) return null
            return (
              <div className="space-y-4">
                <Card className="border-0 bg-blue-50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Bugun</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Savdolar:</span><span className="font-medium">{stats.today.count} ta</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Jami:</span><span className="font-medium">{formatPrice(stats.today.total)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Foyda:</span><span className="font-medium text-green-600">{formatPrice(stats.today.profit)}</span></div>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-indigo-50">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Bu oy</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Savdolar:</span><span className="font-medium">{stats.month.count} ta</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Jami:</span><span className="font-medium">{formatPrice(stats.month.total)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Foyda:</span><span className="font-medium text-green-600">{formatPrice(stats.month.profit)}</span></div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Hisoblangan maosh:</span>
                      <span className="text-indigo-600">{formatPrice(calcSalary(w, stats.month.profit))}</span>
                    </div>
                    {w.salary.salesPercent > 0 && (
                      <div className="text-xs text-slate-500">
                        {formatPrice(w.salary.fixed)} + {w.salary.salesPercent}% × {formatPrice(stats.month.profit)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
