import React from 'react'
import { Package, Plus } from 'lucide-react'
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
  const outOfStock = (p.stock ?? 0) <= 0
  const lowStock = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5

  return (
    <button
      onClick={() => onClick(p)}
      className={`group relative text-left bg-white rounded-2xl overflow-hidden transition-all duration-200 ${
        outOfStock
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]'
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-slate-200" />
          </div>
        )}

        {/* Stock badge */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Tugagan</span>
          </div>
        )}
        {lowStock && (
          <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            {p.stock} ta qoldi
          </span>
        )}

        {/* Add button */}
        {!outOfStock && (
          <div className="absolute bottom-2 right-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <Plus className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="text-[13px] font-medium text-slate-800 line-clamp-2 leading-tight min-h-[2.5em]">{p.name}</div>
        {p.category && (
          <div className="text-[10px] text-slate-400 mt-0.5">{p.category.name}</div>
        )}
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-[15px] font-bold text-blue-600">{formatPrice(p.salePrice)}</span>
          <span className="text-[10px] text-slate-400">/{p.unit}</span>
        </div>
      </div>
    </button>
  )
})
