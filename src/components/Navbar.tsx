import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle, useTheme } from "@/components/ThemeToggle";
import { Moon, Sun } from "lucide-react";

/**
 * Reusable royal-styled navbar.
 *
 * Drop-in requirements for another project:
 *  - shadcn/ui: input, button, dropdown-menu
 *  - lucide-react
 *  - @tanstack/react-router (or swap Link/useNavigate for react-router-dom)
 *  - Tailwind + the `.royal-navbar` / `.royal-button-outlined` classes from styles.css
 *
 * All data and auth state is passed in via props, so it's framework-agnostic
 * about *where* the user/session comes from.
 */

export interface NavbarMatch {
  id: string;
  name: string;
}

export interface NavbarUserMeta {
  avatar_url?: string;
  picture?: string;
  full_name?: string;
  name?: string;
}

export interface NavbarProps {
  // Auth / user
  user: { id: string; email?: string | null; user_metadata?: NavbarUserMeta } | null;
  profile: { display_name: string | null } | null;
  isAdmin: boolean;
  isFamilyMember: boolean;
  role: "admin" | "member" | "visitor" | null;
  onSignOut: () => void;

  // Search
  query: string;
  onQueryChange: (q: string) => void;
  matches: NavbarMatch[];
  onSelectMatch: (id: string) => void;

  // "My node" / "Add me" actions (optional — omit to hide)
  hasMyNode?: boolean;
  onMyNode?: () => void;
  pendingJoinRequest?: boolean;
  onOpenJoin?: () => void;

  // Branding
  logoSrc?: string;
  title?: string;
  fallbackInitial?: string;
}

export function Navbar({
  user,
  profile,
  isAdmin,
  isFamilyMember,
  role,
  onSignOut,
  query,
  onQueryChange,
  matches,
  onSelectMatch,
  hasMyNode,
  onMyNode,
  pendingJoinRequest,
  onOpenJoin,
  logoSrc = "/logo.png",
  title = "तड़ियाल वंश",
  fallbackInitial = "त",
}: NavbarProps) {
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { theme, mounted, toggle: toggleTheme } = useTheme();

  const meta = (user?.user_metadata ?? {}) as NavbarUserMeta;
  const googlePhoto = meta.avatar_url || meta.picture || null;
  const nameSource =
    profile?.display_name ||
    meta.full_name ||
    meta.name ||
    (user?.email ? user.email.split("@")[0] : "");
  const parts = nameSource.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length
    ? ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase()
    : "";

  const roleLabel = isAdmin
    ? "Admin"
    : isFamilyMember
    ? "Family member"
    : role === "visitor"
    ? "Visitor"
    : user
    ? "New member"
    : "Guest";

  return (
    <header className="royal-navbar grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-6 sm:px-6 sm:py-4 overflow-visible relative">
      {/* Logo + title */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-4 sm:shrink-0">
        {!logoError ? (
          <img
            src={logoSrc}
            alt="Family logo"
            width={96}
            height={96}
            decoding="async"
            fetchPriority="high"
            className="h-12 w-12 shrink-0 rounded-full border-2 border-yellow-600 object-cover sm:h-20 sm:w-20 md:h-24 md:w-24"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-yellow-600 bg-yellow-900/30 text-lg font-semibold text-yellow-500 sm:h-20 sm:w-20 sm:text-2xl md:h-24 md:w-24">
            {fallbackInitial}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-yellow-400 pointer-events-none select-none sm:text-xl">
            {title}
          </h1>
        </div>
      </div>

      {/* Search */}
      <div
        className={`relative sm:order-0 sm:flex-1 sm:max-w-md ${
          mobileSearchOpen ? "order-3 col-span-2 w-full" : "hidden sm:block"
        }`}
      >
        <div className="flex h-11 w-full items-stretch overflow-hidden rounded-md border-2 border-yellow-600 bg-white shadow-md focus-within:border-yellow-400 focus-within:shadow-[0_0_0_3px_rgba(201,169,97,0.35)]">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search family members..."
            aria-label="Search family members"
            autoFocus={mobileSearchOpen}
            className="h-full flex-1 rounded-none border-0 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button
            type="button"
            aria-label={mobileSearchOpen ? "Close search" : "Search"}
            onClick={() => {
              if (mobileSearchOpen) {
                onQueryChange("");
                setMobileSearchOpen(false);
              }
            }}
            className="flex h-full w-12 items-center justify-center bg-linear-to-b from-yellow-400 to-yellow-500 text-slate-900 transition-colors hover:from-yellow-300 hover:to-yellow-400 active:from-yellow-500 active:to-yellow-600"
          >
            {mobileSearchOpen ? <X className="h-5 w-5 sm:hidden" strokeWidth={2.5} /> : null}
            <Search className={`h-5 w-5 ${mobileSearchOpen ? "hidden sm:block" : ""}`} strokeWidth={2.5} />
          </button>
        </div>
        {matches.length > 0 && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-w-[95vw] overflow-hidden rounded-md border border-yellow-600/30 bg-slate-900 shadow-lg sm:w-full">
            {matches.map((p) => (
              <button
                key={p.id}
                className="block w-full truncate px-3 py-1.5 text-left text-sm leading-tight text-yellow-100 hover:bg-yellow-600/20"
                onClick={() => {
                  onSelectMatch(p.id);
                  onQueryChange("");
                  setMobileSearchOpen(false);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right cluster: mobile search icon, Add me / My node, avatar menu */}
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 sm:shrink-0">
        {!mobileSearchOpen && (
          <button
            type="button"
            aria-label="Search"
            onClick={() => setMobileSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-yellow-600 bg-linear-to-b from-yellow-400 to-yellow-500 text-slate-900 shadow-md sm:hidden"
          >
            <Search className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}

        {!user ? (
          <Button size="sm" onClick={() => navigate({ to: "/auth" })} className="royal-button-outlined select-none">
            Login to edit/add
          </Button>
        ) : (
          <>
            {!hasMyNode && onOpenJoin && (
              <Button
                size="sm"
                disabled={pendingJoinRequest}
                onClick={onOpenJoin}
                className="royal-button-outlined select-none"
              >
                {pendingJoinRequest ? "Request pending" : "Add me"}
              </Button>
            )}
            {hasMyNode && onMyNode && (
              <Button size="sm" onClick={onMyNode} className="royal-button-outlined select-none">
                My node
              </Button>
            )}
          </>
        )}

        <ThemeToggle className="hidden sm:flex" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-600 bg-linear-to-b from-yellow-400 to-yellow-500 text-slate-900 shadow-md overflow-hidden p-0"
            >
              {user && googlePhoto ? (
                <img
                  src={googlePhoto}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : user && initials ? (
                <span className="text-sm font-bold">{initials}</span>
              ) : (
                <Menu className="h-5 w-5" strokeWidth={2.5} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate">
              {user ? profile?.display_name ?? user.email : "Login"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                toggleTheme();
              }}
              className="sm:hidden"
            >
              {mounted && theme === "dark" ? (
                <>
                  <Sun className="mr-2 h-4 w-4" /> Light mode
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4" /> Dark mode
                </>
              )}
            </DropdownMenuItem>
            {user ? (
              <DropdownMenuItem onSelect={() => onSignOut()}>Sign out</DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/auth">Sign in</Link>
              </DropdownMenuItem>
            )}
            {user && isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/auth">{role === "visitor" ? "Continue as visitor" : "Guest view"}</Link>
              </DropdownMenuItem>
            )}
            {user && isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/admin">Admin Panel</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
