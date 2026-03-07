import React from 'react'
import { Pencil, Trash2, Package, Printer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'
import { printLabel } from '@/lib/print'

interface Category { _id: string; name: string }
interface Product {
  _id: string; name: string; unit: string; costPrice: number; salePrice: number
  discountPrice?: number; discountThreshold?: number; description?: string
  image?: string; isActive: boolean; category?: Category; stock: number
}

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
}

export const TovarProductCard = React.memo(function TovarProductCard({ product: p, onEdit, onDelete }: ProductCardProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex gap-3">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-slate-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-slate-800 text-sm line-clamp-1">{p.name}</div>
            <div className="flex gap-1 flex-shrink-0">
              <button className="p-1 hover:bg-blue-50 rounded" title="Label chiqarish" onClick={() => {
                printLabel({ _id: p._id, name: p.name, salePrice: p.salePrice, unit: p.unit, category: p.category?.name, discountPrice: p.discountPrice, discountThreshold: p.discountThreshold })
              }}>
                <Printer className="w-3.5 h-3.5 text-blue-400" />
              </button>
              <button className="p-1 hover:bg-slate-100 rounded" onClick={() => onEdit(p)}>
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button className="p-1 hover:bg-red-50 rounded" onClick={() => onDelete(p._id)}>
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>
          {p.category && <Badge variant="outline" className="text-xs mt-0.5">{p.category.name}</Badge>}
          <div className="mt-2 space-y-0.5">
            <div className="text-xs text-slate-500">Tannarx: <span className="font-medium">{formatPrice(p.costPrice)}</span></div>
            <div className="text-xs text-blue-600 font-bold">{formatPrice(p.salePrice)} / {p.unit}</div>
            {p.discountPrice && p.discountThreshold && (
              <div className="text-xs text-green-600">{p.discountThreshold}+ dona: {formatPrice(p.discountPrice)}</div>
            )}
            <div className={`text-xs font-medium mt-1 ${(p.stock ?? 0) <= 0 ? 'text-red-500' : (p.stock ?? 0) <= 5 ? 'text-orange-500' : 'text-slate-500'}`}>
              Qoldiq: {p.stock ?? 0} {p.unit}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
