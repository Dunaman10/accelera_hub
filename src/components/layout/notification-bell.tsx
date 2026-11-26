"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import type { Notification, UserRole } from "@/types";
import { formatDateTimeWIB } from "@/lib/constants";
import { getSubmissionDetailHrefForRole } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  role: UserRole;
}

export function NotificationBell({ role }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        ok: boolean;
        notifications?: Notification[];
        unreadCount?: number;
      };
      if (data.ok) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Abaikan error jaringan latar belakang
    }
  }, []);

  React.useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  // Tutup popover saat klik di luar
  React.useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  async function handleNotificationClick(item: Notification) {
    setOpen(false);
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
      } catch {
        // Ignore
      }
    }

    if (item.submission_id) {
      const targetHref = getSubmissionDetailHrefForRole(
        role,
        item.submission_id
      );
      router.push(targetHref);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void fetchNotifications();
        }}
        className="relative"
        aria-label="Notifikasi"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-xs font-bold">Notifikasi In-App</p>
              <p className="text-[11px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} pesan belum dibaca`
                  : "Semua notifikasi telah dibaca"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={handleMarkAllRead}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <CheckCheck className="size-3.5" />
                Tandai Dibaca
              </Button>
            )}
          </div>

          <div className="max-h-80 divide-y overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center text-xs text-muted-foreground">
                <Inbox className="size-7 stroke-1" />
                <p>Belum ada notifikasi masuk.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-4 py-3 text-left text-xs transition-colors hover:bg-muted/60",
                    !item.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "font-semibold leading-snug",
                        !item.is_read ? "text-primary" : "text-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                    {!item.is_read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {item.message}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{formatDateTimeWIB(item.created_at)}</span>
                    {item.submission_id && (
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        Buka Agenda
                        <ExternalLink className="size-2.5" />
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
