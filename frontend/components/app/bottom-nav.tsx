'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wrench, FolderLock, NotebookPen, Flame, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { name: 'Tools', href: '/tools/qr-code', icon: Wrench, match: '/tools' },
  { name: 'Files', href: '/tools/vault', icon: FolderLock, match: '/tools/vault' },
  { name: 'Notes', href: '/tools/notes', icon: NotebookPen, match: '/tools/notes' },
  { name: 'Habits', href: '/tools/habits', icon: Flame, match: '/tools/habits' },
  { name: 'You', href: '/profile', icon: User, match: '/profile' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.match === '/tools' ? pathname.startsWith('/tools') : pathname.startsWith(item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
