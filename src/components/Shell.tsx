"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Flag,
  BarChart3,
  Map,
  Lightbulb,
  NotebookText,
  Dumbbell,
  MessageSquare,
  Settings as SettingsIcon,
  Plus,
  Users,
  LogIn,
  CircleUser,
} from "lucide-react";
import { cn } from "@/lib/util";
import { useAuth } from "@/lib/firebase/auth";
import { roleAllowsCoach } from "@/lib/firebase/profiles";
import { MigrationBanner } from "./MigrationBanner";

/** Routes that don't require authentication and render without the shell chrome. */
const PUBLIC_PATHS = ["/", "/auth", "/onboard"];

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Only show when the current user has a coach-capable role. */
  coachOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rounds", label: "Rounds", icon: Flag },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/courses", label: "Courses", icon: Map },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/chat", label: "Coach chat", icon: MessageSquare },
  { href: "/notes", label: "Notes", icon: NotebookText },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/coach", label: "Coach", icon: Users, coachOnly: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function AccountChip() {
  const auth = useAuth();
  if (auth.status === "loading") {
    return (
      <Link
        href="/account"
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm muted"
      >
        <CircleUser size={17} />
        <span>Loading…</span>
      </Link>
    );
  }
  if (auth.status === "anon") {
    return (
      <Link
        href="/auth"
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)]"
      >
        <LogIn size={17} />
        <span>Sign in</span>
      </Link>
    );
  }
  const name =
    auth.profile?.displayName ?? auth.user.displayName ?? auth.user.email ?? "Account";
  const role = auth.profile?.role ?? "player";
  return (
    <Link
      href="/account"
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-[var(--surface-2)]"
    >
      <CircleUser size={17} />
      <div className="min-w-0 flex-1">
        <div className="truncate leading-tight">{name}</div>
        <div className="muted text-[11px] capitalize leading-tight">
          {role}
        </div>
      </div>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const isPublic = PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")
  );

  // Public routes (landing, auth, onboard) render without any shell chrome.
  if (isPublic) return <>{children}</>;

  // ── Auth gate ──────────────────────────────────────────────────────────────
  // Sidebar and app content are NEVER rendered unless the user is confirmed
  // signed-in. Both "loading" and "anon" are treated as ungated states.

  if (auth.status === "loading") {
    // Firebase is still resolving the persisted session — show a neutral spinner.
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--background)]">
        <div className="muted text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (auth.status === "anon") {
    // Not signed in — show a full-page gate and redirect to /auth.
    return <AuthGate pathname={pathname} router={router} />;
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");

  const visibleNav = NAV.filter(
    (i) => !i.coachOnly || roleAllowsCoach(auth.profile?.role)
  );

  // Mobile bottom nav: prioritise core player items + Coach if applicable.
  const mobileNav = visibleNav
    .filter((i) =>
      ["/dashboard", "/rounds", "/stats", "/courses", "/coach"].includes(i.href)
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-[var(--border)] md:bg-[var(--surface)]">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white grid place-items-center text-sm font-bold">
            G
          </div>
          <div>
            <div className="font-semibold leading-tight">Golf Tracker</div>
            <div className="text-xs muted leading-tight">Local-first</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                )}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pt-2 border-t border-[var(--border)]">
          <AccountChip />
        </div>
        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/rounds/new"
            className="btn btn-primary w-full"
          >
            <Plus size={16} /> New Round
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-white grid place-items-center text-xs font-bold">
            G
          </div>
          <span className="font-semibold text-sm">Golf Tracker</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="btn btn-ghost !py-1.5 !px-2 text-xs"
            aria-label="Account"
          >
            <CircleUser size={14} />
          </Link>
          <Link href="/rounds/new" className="btn btn-primary !py-1.5 !px-3 text-xs">
            <Plus size={14} /> Round
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8 md:overflow-y-auto">
        <MigrationBanner />
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] z-20">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))`,
          }}
        >
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px]",
                  active ? "text-[var(--accent)]" : "muted"
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ── Auth gate ────────────────────────────────────────────────────────────────

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

function AuthGate({
  pathname,
  router,
}: {
  pathname: string;
  router: AppRouterInstance;
}) {
  // Redirect immediately; also render a visible prompt as a fallback.
  useEffect(() => {
    router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[var(--background)] px-4">
      <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white grid place-items-center text-lg font-bold select-none">
        m
      </div>
      <div className="text-center">
        <p className="font-semibold text-lg">Sign in to continue</p>
        <p className="muted text-sm mt-1">You need an account to access this page.</p>
      </div>
      <div className="flex gap-3">
        <Link href={`/auth?next=${encodeURIComponent(pathname)}`} className="btn btn-primary">
          Sign in
        </Link>
        <Link href="/" className="btn btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
