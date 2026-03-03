import React, { useRef } from 'react'
import { Camera, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface Category { _id: string; name: string }

export interface ProductForm {
  name: string; categoryId: string; unit: string; costPrice: string; salePrice: string
  discountPrice: string; discountThreshold: string; description: string; image: string; stock: string
}

const UNITS = ['dona', 'kg', 'm', 'l']

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: boolean
  form: ProductForm
  onFormChange: (updater: (prev: ProductForm) => ProductForm) => void
  categories: Category[]
  loading: boolean
  onSave: () => void
}

export function ProductDialog({
  open, onOpenChange, editing, form, onFormChange, categories, loading, onSave,
}: ProductDialogProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onFormChange(f => ({ ...f, image: reader.result as string }))
    reader.readAsDataURL(file)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Tahrirlash' : 'Yangi mahsulot'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={e => onFormChange(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategoriya</Label>
                <Select value={form.categoryId} onValueChange={v => onFormChange(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Birlik</Label>
                <Select value={form.unit} onValueChange={v => onFormChange(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tannarx *</Label>
                <Input type="number" value={form.costPrice} onChange={e => onFormChange(f => ({ ...f, costPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Sotuv narxi *</Label>
                <Input type="number" value={form.salePrice} onChange={e => onFormChange(f => ({ ...f, salePrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Qoldiq *</Label>
                <Input type="number" value={form.stock} onChange={e => onFormChange(f => ({ ...f, stock: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ulgurji narx</Label>
                <Input type="number" placeholder="Ko'p olsangiz" value={form.discountPrice} onChange={e => onFormChange(f => ({ ...f, discountPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Minimal miqdor</Label>
                <Input type="number" placeholder="Nechta dan" value={form.discountThreshold} onChange={e => onFormChange(f => ({ ...f, discountThreshold: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Textarea rows={2} value={form.description} onChange={e => onFormChange(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rasm</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-1.5" />Kamera
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => galleryInputRef.current?.click()}>
                  <Image className="w-4 h-4 mr-1.5" />Galereya
                </Button>
              </div>
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
              )}
            </div>
            <Button className="w-full" onClick={onSave} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs — outside Dialog to avoid portal ref issues */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
    </>
  )
}
