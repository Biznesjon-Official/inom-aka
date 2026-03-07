'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Settings, Save, Loader2 } from 'lucide-react'
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

      <Card className="max-w-xl">
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
    </div>
  )
}
