"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FilePlus2,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  TableProperties,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import type { Profile, UserRole, Vendor } from "@/types";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  BreadcrumbProvider,
  useBreadcrumbLabel,
} from "@/components/layout/breadcrumb-context";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface CrumbItem {
  label: string;
  href?: string;
}

function getNavigationForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "mitra":
      return [
        {
          label: "Dashboard & Tracking",
          href: "/mitra",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Ajukan Tagihan Baru",
          href: "/mitra/submissions/new",
          icon: FilePlus2,
        },
      ];
    case "admin_accelera":
      return [
        {
          label: "Dashboard Penagihan",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Tabel Monitoring",
          href: "/monitoring",
          icon: TableProperties,
        },
        {
          label: "Antrean Pemeriksaan",
          href: "/admin/queue",
          icon: ClipboardCheck,
        },
        {
          label: "Master Vendor / Mitra",
          href: "/admin/vendors",
          icon: Building2,
        },
        {
          label: "Master Hari Libur SLA",
          href: "/admin/holidays",
          icon: CalendarDays,
        },
        {
          label: "Manajemen User",
          href: "/admin/users",
          icon: Users,
        },
      ];
    case "pic_usaha":
      return [
        {
          label: "Dashboard Penagihan",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Verifikasi PIC Usaha",
          href: "/pic",
          icon: ShieldCheck,
          exact: true,
        },
        {
          label: "Tabel Monitoring",
          href: "/monitoring",
          icon: TableProperties,
        },
      ];
    case "akuntansi":
      return [
        {
          label: "Dashboard Penagihan",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Validasi Akuntansi",
          href: "/akuntansi",
          icon: FileSpreadsheet,
          exact: true,
        },
        {
          label: "Arsip SPP Digital",
          href: "/spp",
          icon: QrCode,
        },
        {
          label: "Tabel Monitoring",
          href: "/monitoring",
          icon: TableProperties,
        },
      ];
    case "divisi_usaha":
      return [
        {
          label: "Dashboard Penagihan",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Monitoring SPP",
          href: "/spp",
          icon: QrCode,
          exact: true,
        },
        {
          label: "Tabel Monitoring",
          href: "/monitoring",
          icon: TableProperties,
        },
      ];
    case "super_admin":
    default:
      return [
        {
          label: "Dashboard Penagihan",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Tabel Monitoring",
          href: "/monitoring",
          icon: TableProperties,
        },
        {
          label: "Antrean Pemeriksaan",
          href: "/admin/queue",
          icon: ClipboardCheck,
        },
        {
          label: "Master Vendor / Mitra",
          href: "/admin/vendors",
          icon: Building2,
        },
        {
          label: "Master Hari Libur SLA",
          href: "/admin/holidays",
          icon: CalendarDays,
        },
        {
          label: "Manajemen User",
          href: "/admin/users",
          icon: Users,
        },
        {
          label: "Portal Mitra",
          href: "/mitra",
          icon: FolderKanban,
          exact: true,
        },
        {
          label: "Ajukan Tagihan",
          href: "/mitra/submissions/new",
          icon: FilePlus2,
        },
        {
          label: "Approval PIC Usaha",
          href: "/pic",
          icon: ShieldCheck,
        },
        {
          label: "Approval Akuntansi",
          href: "/akuntansi",
          icon: FileSpreadsheet,
        },
        {
          label: "Monitoring SPP",
          href: "/spp",
          icon: QrCode,
        },
      ];
  }
}

function getBreadcrumbs(
  pathname: string,
  role: UserRole,
  dynamicLabel: string | null
): CrumbItem[] {
  const rootHref = role === "mitra" ? "/mitra" : "/dashboard";
  const rootLabel = role === "mitra" ? "Portal Mitra" : "Dashboard";

  if (pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }
  if (pathname === "/monitoring") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Tabel Monitoring" },
    ];
  }
  if (pathname === "/admin/queue") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Antrean Pemeriksaan" },
    ];
  }
  if (pathname.startsWith("/admin/submissions/")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Antrean Pemeriksaan", href: "/admin/queue" },
      { label: dynamicLabel || "Detail Pemeriksaan" },
    ];
  }
  if (pathname === "/admin/vendors") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Master Vendor / Mitra" },
    ];
  }
  if (pathname === "/admin/holidays") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Master Hari Libur SLA" },
    ];
  }
  if (pathname === "/admin/users") {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Manajemen User" },
    ];
  }
  if (pathname === "/mitra") {
    return [{ label: "Portal Mitra" }];
  }
  if (pathname === "/mitra/submissions/new") {
    return [
      { label: "Portal Mitra", href: "/mitra" },
      { label: "Ajukan Tagihan Baru" },
    ];
  }
  if (pathname.startsWith("/mitra/submissions/")) {
    return [
      { label: "Portal Mitra", href: "/mitra" },
      { label: dynamicLabel || "Detail Tagihan" },
    ];
  }
  if (pathname === "/pic") {
    return [
      ...(role === "super_admin"
        ? [{ label: "Dashboard", href: "/dashboard" }]
        : []),
      { label: "Verifikasi PIC Usaha" },
    ];
  }
  if (pathname.startsWith("/pic/submissions/")) {
    return [
      { label: "Verifikasi PIC Usaha", href: "/pic" },
      { label: dynamicLabel || "Detail Verifikasi" },
    ];
  }
  if (pathname === "/akuntansi") {
    return [
      ...(role === "super_admin"
        ? [{ label: "Dashboard", href: "/dashboard" }]
        : []),
      { label: "Validasi Akuntansi" },
    ];
  }
  if (pathname.startsWith("/akuntansi/submissions/")) {
    return [
      { label: "Validasi Akuntansi", href: "/akuntansi" },
      { label: dynamicLabel || "Detail Validasi" },
    ];
  }
  if (pathname === "/spp") {
    return [
      ...(role === "super_admin" || role === "akuntansi"
        ? [{ label: "Dashboard", href: "/dashboard" }]
        : []),
      { label: "Monitoring SPP" },
    ];
  }
  if (pathname.startsWith("/spp/submissions/")) {
    return [
      { label: "Monitoring SPP", href: "/spp" },
      { label: dynamicLabel || "Detail Penerbitan SPP" },
    ];
  }

  return [{ label: rootLabel, href: rootHref }];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface DashboardShellProps {
  profile: Profile;
  vendor: Vendor | null;
  queueCounts?: Record<string, number>;
  children: React.ReactNode;
}

function DashboardShellInner({
  profile,
  vendor,
  queueCounts = {},
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dynamicLabel = useBreadcrumbLabel();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const navItems = React.useMemo(
    () => getNavigationForRole(profile.role),
    [profile.role]
  );

  const breadcrumbs = React.useMemo(
    () => getBreadcrumbs(pathname, profile.role, dynamicLabel),
    [pathname, profile.role, dynamicLabel]
  );

  function isNavItemActive(item: NavItem): boolean {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Berhasil keluar dari sesi.");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Gagal keluar dari sesi.");
    } finally {
      setSigningOut(false);
    }
  }

  const initials = getInitials(profile.full_name);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground lg:flex-row">
      {/* SIDEBAR DESKTOP (FIXED) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-70 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-17 items-center border-b border-sidebar-border px-5">
          <Link
            href={profile.role === "mitra" ? "/mitra" : "/dashboard"}
            className="flex items-center transition-opacity hover:opacity-90"
          >
            <BrandLogo
              variant="horizontal"
              size="md"
              subtitle="SLA 6 Hari Kerja"
            />
          </Link>
        </div>

        {/* Konteks Perusahaan Mitra (Khusus Mitra) */}
        {vendor && (
          <div className="border-b border-sidebar-border bg-surface-subtle/70 px-5 py-3.5">
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Perusahaan Mitra
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="size-4 shrink-0 text-brand-teal" />
              <span className="truncate">{vendor.name}</span>
            </div>
          </div>
        )}

        {/* Menu Navigasi */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item);
            const badgeCount = queueCounts[item.href] ?? 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    !active && "text-brand-teal/90"
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      "ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                      active
                        ? "bg-white/20 text-sidebar-primary-foreground dark:bg-black/20"
                        : "bg-brand-teal/15 text-accent-foreground"
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Portal Penagihan</span>
            <Badge variant="secondary" className="text-xs font-semibold">
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
        </div>
      </aside>

      {/* TOPBAR & MAIN CONTENT */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-70">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-17 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu navigasi"
            >
              <Menu className="size-5" />
            </Button>

            {/* Mobile Current Page Title */}
            <div className="flex min-w-0 items-center gap-2.5 sm:hidden">
              <BrandLogo variant="mark" size="sm" />
              <span className="truncate text-sm font-bold text-foreground">
                {breadcrumbs[breadcrumbs.length - 1]?.label ?? "Accelera HUB"}
              </span>
            </div>

            {/* Desktop & Tablet Dynamic Breadcrumbs */}
            <Breadcrumb className="hidden min-w-0 sm:block">
              <BreadcrumbList className="flex-nowrap text-sm">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={`${crumb.label}-${idx}`}>
                      <BreadcrumbItem className="min-w-0">
                        {isLast || !crumb.href ? (
                          <BreadcrumbPage className="max-w-[280px] truncate font-semibold text-foreground">
                            {crumb.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            render={<Link href={crumb.href} />}
                            className="max-w-[200px] truncate font-medium text-muted-foreground hover:text-primary"
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <ThemeToggle />
            <NotificationBell role={profile.role} />

            {/* Single User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </span>
                <div className="hidden min-w-0 flex-col sm:flex">
                  <span className="max-w-[150px] truncate text-xs font-semibold text-foreground leading-tight">
                    {profile.full_name}
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-68">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="space-y-1.5 p-2.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {profile.full_name}
                    </p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {profile.email}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="secondary" className="text-xs">
                        {ROLE_LABELS[profile.role]}
                      </Badge>
                      {vendor && (
                        <Badge
                          variant="outline"
                          className="max-w-[190px] truncate text-xs"
                        >
                          {vendor.name}
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onClick={handleSignOut}
                  className="cursor-pointer gap-2 py-2.5 text-sm font-medium"
                >
                  {signingOut ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  {signingOut ? "Sedang Keluar..." : "Keluar Akun"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* MOBILE DRAWER */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative z-10 flex w-76 max-w-[86vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
                <BrandLogo
                  variant="horizontal"
                  size="sm"
                  subtitle="SLA 6 Hari Kerja"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Tutup menu navigasi"
                >
                  <X className="size-4" />
                </Button>
              </div>

              {vendor && (
                <div className="border-b border-sidebar-border bg-surface-subtle/70 px-4 py-3">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Perusahaan Mitra
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {vendor.name}
                  </p>
                </div>
              )}

              <nav className="flex-1 space-y-1.5 overflow-y-auto p-3.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item);
                  const badgeCount = queueCounts[item.href] ?? 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          !active && "text-brand-teal"
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className={cn(
                            "ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                            active
                              ? "bg-white/20 text-sidebar-primary-foreground dark:bg-black/20"
                              : "bg-brand-teal/15 text-accent-foreground"
                          )}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <div className="space-y-2.5 border-t border-sidebar-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tema Tampilan
                  </span>
                  <ThemeToggle showLabel />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  Keluar Akun
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 pb-10 sm:p-6 lg:p-8 lg:pb-10">
          <div
            className={cn(
              "mx-auto w-full",
              pathname.startsWith("/admin/submissions/") ||
                pathname.startsWith("/pic/submissions/") ||
                pathname.startsWith("/akuntansi/submissions/") ||
                pathname.startsWith("/spp/submissions/") ||
                pathname === "/dashboard" ||
                pathname.startsWith("/dashboard/") ||
                pathname === "/monitoring" ||
                pathname.startsWith("/monitoring/")
                ? "max-w-[1600px]"
                : "max-w-6xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <BreadcrumbProvider>
      <DashboardShellInner {...props} />
    </BreadcrumbProvider>
  );
}
