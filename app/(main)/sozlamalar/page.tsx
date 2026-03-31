'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Settings, Save, Loader2, Lock, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

const DEFAULTS = {
  shopName: "Inomaka Do'kon",
  shopPhone: '',
  shopAddress: '',
  receiptFooter: 'Rahmat! Yana tashrif buyuring.',
}

export default function SozlamalarPage() {
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Password change
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)

  // Backup
  const [backupLoading, setBackupLoading] = useState(false)

  const handleBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) throw new Error('Backup xato')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inomaka_backup_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup yuklandi')
    } catch {
      toast.error('Backup yaratishda xato')
    } finally {
      setBackupLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setForm(prev => ({
          shopName: data.shopName || prev.shopName,
          shopPhone: data.shopPhone || prev.shopPhone,
          shopAddress: data.shopAddress || prev.shopAddress,
          receiptFooter: data.receiptFooter || prev.receiptFooter,
        }))
      })
      .catch(() => toast.error('Sozlamalarni yuklashda xato'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const entries = Object.entries(form)
      for (const [key, value] of entries) {
        await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
      }
      toast.success('Sozlamalar saqlandi')
    } catch {
      toast.error('Saqlashda xato yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handlePasswordChange = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('Barcha maydonlarni to\'ldiring')
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Yangi parollar mos kelmaydi')
    if (pwForm.newPassword.length < 6) return toast.error('Parol kamida 6 belgidan iborat bo\'lishi kerak')

    setPwSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Xato yuz berdi')
      } else {
        toast.success('Parol muvaffaqiyatli o\'zgartirildi')
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
    } catch {
      toast.error('Xato yuz berdi')
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Sozlamalar</h1>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <h3 className="font-semibold">Ma&apos;lumotlar zaxirasi</h3>
            <p className="text-sm text-muted-foreground">Barcha ma&apos;lumotlar va rasmlar ZIP formatda yuklanadi</p>
          </div>
          <Button onClick={handleBackup} disabled={backupLoading} variant="outline">
            {backupLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {backupLoading ? 'Tayyorlanmoqda...' : 'Backup yuklash'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Do&apos;kon sozlamalari</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Do&apos;kon nomi</Label>
              <Input id="shopName" value={form.shopName} onChange={set('shopName')} placeholder="Inomaka Do'kon" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopPhone">Telefon raqam</Label>
              <Input id="shopPhone" value={form.shopPhone} onChange={set('shopPhone')} placeholder="+998 XX XXX XX XX" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopAddress">Manzil</Label>
              <Input id="shopAddress" value={form.shopAddress} onChange={set('shopAddress')} placeholder="Toshkent, ..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptFooter">Chek pastidagi matn</Label>
              <Textarea id="receiptFooter" value={form.receiptFooter} onChange={set('receiptFooter')} rows={2} placeholder="Rahmat! Yana tashrif buyuring." />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Saqlash
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Parol o&apos;zgartirish
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Joriy parol</Label>
              <Input type="password" value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Hozirgi parolingiz" />
            </div>
            <div className="space-y-2">
              <Label>Yangi parol</Label>
              <Input type="password" value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Kamida 6 belgi" />
            </div>
            <div className="space-y-2">
              <Label>Yangi parolni tasdiqlang</Label>
              <Input type="password" value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Qayta kiriting" />
            </div>
            <Button onClick={handlePasswordChange} disabled={pwSaving} className="w-full" variant="outline">
              {pwSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Parolni o&apos;zgartirish
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
