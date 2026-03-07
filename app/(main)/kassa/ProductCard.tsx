import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface Product {
  _id: string
  name: string
  unit: string
  salePrice: number
  costPrice: number
  wholesalePrice?: number
  category?: { name: string }
  stock: number
  image?: string
}

interface ProductCardProps {
  product: Product
  onClick: (product: Product) => void
}

export const ProductCard = React.memo(function ProductCard({ product: p, onClick }: ProductCardProps) {
  return (
    <button onClick={() => onClick(p)}
      className={`text-left bg-white rounded-xl border transition-all overflow-hidden ${(p.stock ?? 0) <= 0 ? 'border-red-200 opacity-60' : 'border-slate-200 hover:border-blue-400 hover:shadow-sm'}`}>
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt={p.name} className="w-full h-24 object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-24 bg-slate-100 flex items-center justify-center">
          <ShoppingCart className="w-6 h-6 text-slate-300" />
        </div>
      )}
      <div className="p-2">
        <div className="text-sm font-medium text-slate-800 line-clamp-2 mb-1">{p.name}</div>
        {p.category && <div className="text-xs text-slate-400 mb-1">{p.category.name}</div>}
        <div className="text-blue-600 font-bold text-sm">{formatPrice(p.salePrice)}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">/{p.unit}</span>
          <span className={`text-xs font-medium ${(p.stock ?? 0) <= 0 ? 'text-red-500' : (p.stock ?? 0) <= 5 ? 'text-orange-500' : 'text-slate-400'}`}>
            {p.stock ?? 0} {p.unit}
          </span>
        </div>
        {p.wholesalePrice && (
          <div className="text-xs text-green-600 mt-0.5">Ulgurji: {formatPrice(p.wholesalePrice)}</div>
        )}
      </div>
    </button>
  )
})
