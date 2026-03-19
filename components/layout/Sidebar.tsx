'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard, ShoppingCart, Package, BookOpen, Wallet,
  TrendingDown, Users, UserCog, Settings, LogOut, Store, FileBarChart, Receipt
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kassa', label: 'Kassa', icon: ShoppingCart },
  { href: '/tovarlar', label: 'Tovarlar', icon: Package },
  { href: '/sotuvlar', label: 'Sotuvlar', icon: Receipt },
{ href: '/qarzlar', label: 'Qarz daftarcha', icon: BookOpen },
  { href: '/shaxsiy-qarzlar', label: 'Shaxsiy qarzlar', icon: Wallet },
  { href: '/xarajatlar', label: 'Xarajatlar', icon: TrendingDown },
  { href: '/mijozlar', label: 'Mijozlar', icon: Users },
  { href: '/ishchilar', label: 'Ishchilar', icon: UserCog },
  { href: '/sozlamalar', label: 'Sozlamalar', icon: Settings },
]

const workerNav = [
  { href: '/kassa', label: 'Kassa', icon: ShoppingCart },
  { href: '/qarzlar', label: 'Qarz daftarcha', icon: BookOpen },
]

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const nav = session?.user.role === 'admin' ? adminNav : workerNav

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white w-64">
      <div className="flex items-center gap-2 p-5 border-b border-slate-700">
        <Store className="w-6 h-6 text-blue-400" />
        <span className="font-bold text-lg">Inomaka CRM</span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center justify-between px-3 py-2 mb-2">
          <div className="text-xs text-slate-400">
            <div className="font-medium text-slate-200">{session?.user.name}</div>
            <div className="capitalize">{session?.user.role === 'admin' ? 'Admin' : 'Ishchi'}</div>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Chiqish
        </Button>
      </div>
    </div>
  )
}
