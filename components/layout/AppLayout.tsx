'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Menu, Loader2 } from 'lucide-react'
import Sidebar from './Sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-slate-800 dark:text-slate-100 flex-1">Inomaka CRM</span>
          <ThemeToggle />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
