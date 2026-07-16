'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, Warehouse, Factory, Store, ShoppingCart,
  RotateCcw, Receipt, BarChart3, TrendingUp, Settings, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/products', label: 'Ürünler', icon: Package },
  { href: '/inventory', label: 'Stok', icon: Warehouse },
  { href: '/production', label: 'Üretim', icon: Factory },
  { href: '/orders', label: 'Siparişler', icon: ShoppingCart },
  { href: '/returns', label: 'İadeler', icon: RotateCcw },
  { href: '/platforms', label: 'Platformlar', icon: Store },
  { href: '/expenses', label: 'Giderler', icon: Receipt },
  { href: '/reports', label: 'Raporlar', icon: BarChart3 },
  { href: '/forecast', label: 'Talep Tahmini', icon: TrendingUp },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-border bg-card/80 backdrop-blur transition-all',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="h-6 w-6 shrink-0 rounded bg-primary" />
        {!collapsed && <span className="font-display text-sm font-semibold tracking-tight">Yonga ERP</span>}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex h-10 items-center justify-center border-t border-border text-muted-foreground hover:bg-accent"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
