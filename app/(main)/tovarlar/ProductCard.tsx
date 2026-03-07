import React from 'react'
import { Pencil, Trash2, Package, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'
import { printLabel } from '@/lib/print'

interface Category { _id: string; name: string }
interface Product {
  _id: string; name: string; unit: string; costPrice: number; salePrice: number
  wholesalePrice?: number
  image?: string; isActive: boolean; category?: Category; stock: number
}

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
}

export const TovarProductCard = React.memo(function TovarProductCard({ product: p, onEdit, onDelete }: ProductCardProps) {
  const outOfStock = (p.stock ?? 0) <= 0
  const lowStock = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5

  return (
    <div className={`group relative bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg ${outOfStock ? 'ring-1 ring-red-200' : ''}`}>
      {/* Image */}
      <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-slate-200" />
          </div>
        )}

        {/* Stock badge */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">Tugagan</span>
          </div>
        )}
        {lowStock && (
          <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
            {p.stock} ta qoldi
          </span>
        )}

        {/* Category badge */}
        {p.category && (
          <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm">
            {p.category.name}
          </span>
        )}

        {/* Action buttons */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:bg-blue-50 transition-colors"
            title="Label chiqarish"
            onClick={() => printLabel({ _id: p._id, name: p.name, salePrice: p.salePrice, wholesalePrice: p.wholesalePrice, unit: p.unit, category: p.category?.name })}
          >
            <Printer className="w-3.5 h-3.5 text-blue-500" />
          </button>
          <button
            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:bg-slate-100 transition-colors"
            onClick={() => onEdit(p)}
          >
            <Pencil className="w-3.5 h-3.5 text-slate-600" />
          </button>
          <button
            className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow hover:bg-red-50 transition-colors"
            onClick={() => onDelete(p._id)}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug min-h-[2.5em]">{p.name}</div>

        {/* Prices */}
        <div className="mt-2 space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-blue-600">{formatPrice(p.salePrice)}</span>
            <span className="text-[11px] text-slate-400">/{p.unit}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">Tannarx: {formatPrice(p.costPrice)}</span>
            {p.wholesalePrice && (
              <span className="text-[11px] text-green-600">Ulgurji: {formatPrice(p.wholesalePrice)}</span>
            )}
          </div>
        </div>

        {/* Stock bar */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${outOfStock ? 'bg-red-500' : lowStock ? 'bg-amber-500' : 'bg-green-500'}`} />
            <span className={`text-xs font-medium ${outOfStock ? 'text-red-600' : lowStock ? 'text-amber-600' : 'text-slate-500'}`}>
              {outOfStock ? 'Stokda yo\'q' : `${p.stock} ${p.unit}`}
            </span>
          </div>
          {!outOfStock && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-green-200 text-green-700 bg-green-50">
              Mavjud
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
})
