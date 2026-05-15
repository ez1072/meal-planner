'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, BookOpen, ShoppingBasket, ChefHat, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/pantry', label: 'Pantry', icon: ShoppingBasket },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 flex-1">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-[#E07B39] text-white shadow-sm'
              : 'text-gray-600 hover:bg-orange-50 hover:text-[#E07B39]'
          )}
        >
          <Icon size={20} />
          {label}
        </Link>
      ))}
    </nav>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 text-[#E07B39] font-bold text-lg">
          <ChefHat size={22} />
          Meal Planner
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="p-2 rounded-lg hover:bg-gray-100">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'md:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-white border-r border-gray-200 p-4 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavLinks />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-200 p-4 z-20">
        <div className="flex items-center gap-2 text-[#E07B39] font-bold text-lg mb-6 px-1">
          <ChefHat size={22} />
          Meal Planner
        </div>
        <NavLinks />
      </aside>
    </>
  )
}
