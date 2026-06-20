import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthModal } from '../auth/AuthModal';
import { Button } from '../ui/Button';

type NavItem = {
  to: string;
  label: string;
  authOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/profil',   label: 'Profil',   authOnly: true },
  { to: '/solo',     label: 'Solo'     },
  { to: '/turnieje', label: 'Turnieje' },
  { to: '/ligi',     label: 'Ligi'     },
  { to: '/rankingi', label: 'Rankingi' },
  { to: '/gracze',   label: 'Gracze'   },
  { to: '/hub',      label: 'Hub',      authOnly: true },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative px-5 py-2 text-sm font-medium tracking-wide transition-colors duration-200',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content-accent rounded-sm',
    isActive
      ? 'text-content-primary after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-content-accent'
      : 'text-content-secondary hover:text-content-primary',
  ].join(' ');

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-lg px-4 py-3 text-base font-medium transition-colors',
    isActive
      ? 'bg-surface-muted text-content-primary'
      : 'text-content-secondary hover:bg-surface-muted hover:text-content-primary',
  ].join(' ');

export function Navbar() {
  const { username, logout } = useAuth();
  const location             = useLocation();
  const [authOpen,   setAuthOpen]   = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleItems = NAV_ITEMS.filter(item => !item.authOnly || !!username);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface-base">
        <nav
          className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6"
          aria-label="Nawigacja główna"
        >
          {/* Logo */}
          <span className="select-none text-lg font-bold uppercase tracking-widest text-content-primary">
            DART
          </span>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-1" role="list">
            {visibleItems.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} className={desktopLinkClass}>{label}</NavLink>
              </li>
            ))}
          </ul>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {username ? (
              <>
                <span className="text-sm text-content-secondary">{username}</span>
                <Button variant="secondary" size="sm" onClick={logout}>Wyloguj</Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setAuthOpen(true)}>
                Zaloguj się
              </Button>
            )}
          </div>

          {/* Mobile hamburger — no IconButton primitive; raw button with semantic tokens */}
          <button
            type="button"
            aria-label={menuOpen ? 'Zamknij menu' : 'Otwórz menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(o => !o)}
            className="flex md:hidden items-center justify-center rounded-lg p-2 text-content-secondary transition-colors hover:bg-surface-muted hover:text-content-primary"
          >
            {menuOpen ? <IconX /> : <IconMenu />}
          </button>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile menu panel */}
      <div
        id="mobile-menu"
        ref={menuRef}
        className={[
          'fixed top-16 inset-x-0 z-40 md:hidden bg-surface-base border-b border-border-subtle',
          'transition-all duration-200 ease-in-out origin-top',
          menuOpen ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-95 pointer-events-none',
        ].join(' ')}
        aria-hidden={!menuOpen}
      >
        <div className="mx-auto max-w-screen-xl px-4 py-3">

          {/* Nav items */}
          <ul role="list" className="flex flex-col gap-1">
            {visibleItems.map(({ to, label }) => (
              <li key={to}>
                <NavLink to={to} className={mobileLinkClass}>{label}</NavLink>
              </li>
            ))}
          </ul>

          {/* Divider + auth */}
          <div className="mt-3 border-t border-border-subtle pt-3">
            {username ? (
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-content-secondary">{username}</span>
                <Button variant="secondary" size="sm" onClick={handleLogout}>Wyloguj</Button>
              </div>
            ) : (
              <Button
                variant="primary"
                fullWidth
                onClick={() => { setMenuOpen(false); setAuthOpen(true); }}
              >
                Zaloguj się
              </Button>
            )}
          </div>

        </div>
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <line x1="3" y1="6"  x2="19" y2="6"  />
      <line x1="3" y1="11" x2="19" y2="11" />
      <line x1="3" y1="16" x2="19" y2="16" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <line x1="4" y1="4" x2="18" y2="18" />
      <line x1="18" y1="4" x2="4" y2="18" />
    </svg>
  );
}
