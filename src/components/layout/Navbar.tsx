import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from '../auth/AuthModal';

type NavItem = {
  to: string;
  label: string;
  authOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/profil',    label: 'Profil',    authOnly: true },
  { to: '/solo',      label: 'Solo'      },
  { to: '/turnieje',  label: 'Turnieje'  },
  { to: '/rankingi',  label: 'Rankingi'  },
  { to: '/gracze',    label: 'Gracze'    },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative px-5 py-2 text-sm font-medium tracking-wide transition-colors duration-200',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple rounded-sm',
    isActive
      ? 'text-brand-white after:absolute after:inset-x-3 after:-bottom-[1px] after:h-[2px] after:rounded-full after:bg-brand-purple'
      : 'text-content-secondary hover:text-brand-white',
  ].join(' ');

export function Navbar() {
  const { username, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(item => !item.authOnly || !!username);

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-brand-black">
      <nav
        className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6"
        aria-label="Nawigacja główna"
      >
        <span className="text-lg font-bold tracking-widest text-brand-white uppercase select-none">
          DART
        </span>

        <ul className="flex items-center gap-1" role="list">
          {visibleItems.map(({ to, label }) => (
            <li key={to}>
              <NavLink to={to} className={navLinkClass}>{label}</NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {username ? (
            <>
              <span className="text-sm text-content-secondary">{username}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:border-brand-white/30 hover:text-brand-white"
              >
                Wyloguj
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-brand-purple/50 px-3 py-1.5 text-xs font-medium text-brand-white transition-colors hover:bg-brand-purple/10"
            >
              Zaloguj się
            </button>
          )}
        </div>
      </nav>

      {modalOpen && <AuthModal onClose={() => setModalOpen(false)} />}
    </header>
  );
}
