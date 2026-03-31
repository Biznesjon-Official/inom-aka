'use client'
import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Category { _id: string; name: string }

interface Props {
  categories: Category[]
  selected: string
  onSelect: (id: string) => void
}

export default function CategoryCarousel({ categories, selected, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
    }
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => scroll('left')}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white border hover:bg-slate-50 shadow-sm"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-none flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => onSelect('all')}
          className={cn(
            'flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors',
            selected === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-white border text-slate-600 hover:bg-slate-50'
          )}
        >
          Barchasi
        </button>
        {categories.map(c => (
          <button
            key={c._id}
            onClick={() => onSelect(c._id)}
            className={cn(
              'flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
              selected === c._id
                ? 'bg-blue-500 text-white'
                : 'bg-white border text-slate-600 hover:bg-slate-50'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <button
        onClick={() => scroll('right')}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white border hover:bg-slate-50 shadow-sm"
      >
        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
      </button>
    </div>
  )
}
