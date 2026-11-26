"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import type { Profile, UserRole, Vendor } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

function getNavigationForRole(role: UserRole): NavItem[] {
  switch (role) {
    case "mitra":
      return [
        {
          label: "Riwayat & Tracking",
          href: "/mitra",
          icon: FolderKanban,
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
          label: "Manajemen User",
          href: "/admin/users",
          icon: Users,
        },
      ];
    case "pic_usaha":
      return [
        {
          label: "Verifikasi PIC Usaha",
          href: "/pic",
          icon: ShieldCheck,
          exact: true,
        },
      ];
    case "akuntansi":
      return [
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
      ];
    case "divisi_usaha":
      return [
        {
          label: "Monitoring SPP",
          href: "/spp",
          icon: QrCode,
          exact: true,
        },
      ];
    case "super_admin":
    default:
      return [
        {
          label: "Executive Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          label: "Antrean Admin Accelera",
          href: "/admin/queue",
          icon: ClipboardCheck,
        },
        {
          label: "Master Vendor / Mitra",
          href: "/admin/vendors",
          icon: Building2,
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

interface DashboardShellProps {
  profile: Profile;
  vendor: Vendor | null;
  children: React.ReactNode;
}

export function DashboardShell({
  profile,
  vendor,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const navItems = React.useMemo(
    () => getNavigationForRole(profile.role),
    [profile.role]
  );

  // Tampilkan maksimal 4 item utama pada Bottom Navigation Mobile
  const bottomNavItems = React.useMemo(() => navItems.slice(0, 4), [navItems]);

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

  return (
    <div className="flex min-h-screen flex-col bg-muted/25 lg:flex-row">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileCheck2 className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">
              Accelera HUB
            </span>
            <span className="text-[11px] text-muted-foreground">
              SLA 6 Hari Kerja
            </span>
          </div>
        </div>

        {/* Info Role & Vendor */}
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold">
              {profile.full_name}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {profile.email}
          </p>
          {vendor && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] font-medium">
              <Building2 className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{vendor.name}</span>
            </div>
          )}
        </div>

        {/* Menu Navigasi */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 text-xs"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="size-3.5" />
            {signingOut ? "Keluar..." : "Keluar Akun"}
          </Button>
        </div>
      </aside>

      {/* MOBILE TOPBAR & MAIN CONTENT */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-xs lg:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu navigasi"
            >
              <Menu className="size-5" />
            </Button>

            <Link
              href={navItems[0]?.href ?? "/"}
              className="flex items-center gap-2 lg:hidden"
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FileCheck2 className="size-3.5" />
              </div>
              <span className="text-sm font-bold">Accelera HUB</span>
            </Link>

            <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
              <span>Ruang Kerja:</span>
              <Badge variant="outline">{ROLE_LABELS[profile.role]}</Badge>
              {vendor && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground">
                    {vendor.name}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {profile.full_name}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
              className="gap-1.5 text-xs"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>

        {/* MOBILE DRAWER */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <FileCheck2 className="size-3.5" />
                  </div>
                  <span className="text-sm font-bold">Accelera HUB</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="border-b bg-muted/30 p-4">
                <p className="text-xs font-semibold">{profile.full_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {profile.email}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {ROLE_LABELS[profile.role]}
                  </Badge>
                  {vendor && (
                    <Badge variant="outline" className="text-[10px]">
                      {vendor.name}
                    </Badge>
                  )}
                </div>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t p-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="size-3.5" />
                  Keluar Akun
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 pb-24 sm:p-6 lg:pb-8">
          <div
            className={cn(
              "mx-auto w-full",
              pathname.startsWith("/admin/submissions/")
                ? "max-w-[1600px]"
                : "max-w-6xl"
            )}
          >
            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION */}
        <nav className="fixed right-0 bottom-0 left-0 z-30 flex h-16 items-center justify-around border-t bg-background/95 px-2 backdrop-blur-xs lg:hidden">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4", active && "stroke-[2.5]")} />
                <span className="max-w-[90px] truncate">{item.label}</span>
              </Link>
            );
          })}
          {navItems.length > 4 && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Menu className="size-4" />
              <span>Lainnya</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
