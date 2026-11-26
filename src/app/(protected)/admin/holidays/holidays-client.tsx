"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  Edit3,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { NationalHoliday } from "@/types";
import {
  deleteHolidayAction,
  saveHolidayAction,
  seedDefaultHolidaysAction,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface HolidaysClientProps {
  initialHolidays: NationalHoliday[];
}

function formatLongIndonesianDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "UTC",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(dateObj);
  } catch {
    return dateStr;
  }
}

export function HolidaysClient({ initialHolidays }: HolidaysClientProps) {
  const router = useRouter();
  const [holidays, setHolidays] =
    React.useState<NationalHoliday[]>(initialHolidays);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [yearFilter, setYearFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<
    "ALL" | "NATIONAL" | "JOINT_LEAVE"
  >("ALL");

  // Modal Form State
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [holidayDate, setHolidayDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isJointLeave, setIsJointLeave] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHolidays(initialHolidays);
  }, [initialHolidays]);

  const availableYears = React.useMemo(() => {
    const years = new Set<number>();
    for (const h of holidays) {
      const y = h.year ?? Number(h.holiday_date.slice(0, 4));
      if (Number.isFinite(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => a - b);
  }, [holidays]);

  const filteredHolidays = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return holidays.filter((h) => {
      const itemYear = String(h.year ?? h.holiday_date.slice(0, 4));
      const jointLeave = Boolean(h.is_joint_leave ?? h.is_cuti_bersama);

      if (yearFilter !== "ALL" && itemYear !== yearFilter) return false;
      if (typeFilter === "NATIONAL" && jointLeave) return false;
      if (typeFilter === "JOINT_LEAVE" && !jointLeave) return false;

      if (!q) return true;
      return (
        h.holiday_date.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q)
      );
    });
  }, [holidays, searchQuery, yearFilter, typeFilter]);

  function openCreateDialog() {
    setEditingId(null);
    setHolidayDate("2026-01-01");
    setDescription("");
    setIsJointLeave(false);
    setDialogOpen(true);
  }

  function openEditDialog(item: NationalHoliday) {
    setEditingId(item.id);
    setHolidayDate(item.holiday_date);
    setDescription(item.description);
    setIsJointLeave(Boolean(item.is_joint_leave ?? item.is_cuti_bersama));
    setDialogOpen(true);
  }

  async function handleSaveHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!holidayDate.trim() || !description.trim()) {
      toast.error("Tanggal dan deskripsi hari libur wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const parsedYear = Number(holidayDate.slice(0, 4));
      const res = await saveHolidayAction({
        id: editingId ?? undefined,
        holiday_date: holidayDate,
        description,
        year: parsedYear,
        is_joint_leave: isJointLeave,
      });

      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Gagal menyimpan data hari libur.");
        return;
      }

      if (editingId) {
        setHolidays((prev) =>
          prev
            .map((item) => (item.id === editingId ? res.data! : item))
            .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
        );
        toast.success("Data hari libur berhasil diperbarui.");
      } else {
        setHolidays((prev) =>
          [...prev, res.data!].sort((a, b) =>
            a.holiday_date.localeCompare(b.holiday_date)
          )
        );
        toast.success("Hari libur baru berhasil ditambahkan.");
      }

      setDialogOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHoliday(item: NationalHoliday) {
    if (
      !window.confirm(
        `Hapus hari libur "${item.description}" (${item.holiday_date}) dari kalender perhitungan SLA?`
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    try {
      const res = await deleteHolidayAction(item.id);
      if (!res.ok) {
        toast.error(res.error ?? "Gagal menghapus hari libur.");
        return;
      }

      setHolidays((prev) => prev.filter((h) => h.id !== item.id));
      toast.success(`Hari libur ${item.holiday_date} berhasil dihapus.`);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSeedDefault() {
    setSeeding(true);
    try {
      const res = await seedDefaultHolidaysAction();
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Gagal memuat seed hari libur 2026-2027.");
        return;
      }

      setHolidays(res.data);
      toast.success(
        "Kalender Hari Libur Nasional & Cuti Bersama Indonesia 2026–2027 berhasil disinkronkan."
      );
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  const totalNational = holidays.filter(
    (h) => !(h.is_joint_leave ?? h.is_cuti_bersama)
  ).length;
  const totalJointLeave = holidays.filter((h) =>
    Boolean(h.is_joint_leave ?? h.is_cuti_bersama)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Master Hari Libur Nasional &amp; Cuti Bersama
          </h1>
          <p className="text-sm text-muted-foreground">
            Seluruh tanggal pada tabel ini otomatis dikecualikan dari perhitungan
            argo SLA 6 Hari Kerja (selain Sabtu &amp; Minggu).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSeedDefault}
            disabled={seeding}
            className="gap-1.5"
          >
            {seeding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Muat Seed SKB 2026–2027
          </Button>

          <Button onClick={openCreateDialog} className="gap-1.5">
            <CalendarPlus className="size-4" />
            Tambah Hari Libur
          </Button>
        </div>
      </div>

      {/* RINGKASAN KPI KALENDER SLA */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tanggal Dikecualikan</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {holidays.length} Hari
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Digunakan oleh fungsi <code>calculate_working_days()</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Libur Nasional Resmi</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {totalNational} Hari
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <code>is_joint_leave = false</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cuti Bersama (Joint Leave)</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {totalJointLeave} Hari
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <code>is_joint_leave = true</code>
          </CardContent>
        </Card>
      </div>

      {/* FILTER BAR */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari tanggal (YYYY-MM-DD) atau nama hari libur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="flex h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium outline-none"
            >
              <option value="ALL">Semua Tahun ({holidays.length})</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  Tahun {y}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={typeFilter === "ALL" ? "default" : "outline"}
                onClick={() => setTypeFilter("ALL")}
              >
                Semua
              </Button>
              <Button
                type="button"
                size="sm"
                variant={typeFilter === "NATIONAL" ? "default" : "outline"}
                onClick={() => setTypeFilter("NATIONAL")}
              >
                Libur Nasional
              </Button>
              <Button
                type="button"
                size="sm"
                variant={typeFilter === "JOINT_LEAVE" ? "default" : "outline"}
                onClick={() => setTypeFilter("JOINT_LEAVE")}
              >
                Cuti Bersama
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABEL HARI LIBUR NASIONAL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            Daftar Hari Libur Nasional ({filteredHolidays.length})
          </CardTitle>
          <CardDescription>
            Tabel <code>national_holidays</code> (<code>holiday_date</code>,{" "}
            <code>description</code>, <code>year</code>,{" "}
            <code>is_joint_leave</code>)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHolidays.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <CalendarDays className="size-8 stroke-1" />
              <p>Belum ada data hari libur yang sesuai dengan filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Tanggal (ISO)</TableHead>
                  <TableHead>Hari &amp; Tanggal Lengkap</TableHead>
                  <TableHead>Deskripsi Hari Libur</TableHead>
                  <TableHead className="w-24">Tahun</TableHead>
                  <TableHead className="w-36">Kategori</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHolidays.map((item) => {
                  const itemYear =
                    item.year ?? Number(item.holiday_date.slice(0, 4));
                  const jointLeave = Boolean(
                    item.is_joint_leave ?? item.is_cuti_bersama
                  );

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {item.holiday_date}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatLongIndonesianDate(item.holiday_date)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.description}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {itemYear}
                      </TableCell>
                      <TableCell>
                        {jointLeave ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                          >
                            Cuti Bersama
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-primary/40 bg-primary/10 text-primary"
                          >
                            Libur Nasional
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                            className="gap-1 text-xs"
                          >
                            <Edit3 className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            disabled={deletingId === item.id}
                            onClick={() => handleDeleteHoliday(item)}
                            title="Hapus Hari Libur"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DIALOG FORM CREATE / EDIT HARI LIBUR */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Edit Hari Libur Nasional"
                : "Tambah Hari Libur Nasional"}
            </DialogTitle>
            <DialogDescription>
              Tanggal yang terdaftar akan memotong perhitungan hari kerja SLA
              internal secara otomatis.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveHoliday} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="holiday-date">
                  Tanggal Libur <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="holiday-date"
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holiday-year">Tahun (Otomatis)</Label>
                <Input
                  id="holiday-year"
                  disabled
                  value={holidayDate ? holidayDate.slice(0, 4) : "-"}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="holiday-description">
                Nama / Keterangan Hari Libur{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="holiday-description"
                required
                placeholder="Contoh: Hari Kemerdekaan Republik Indonesia"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="text-xs font-semibold">
                  Cuti Bersama (<code>is_joint_leave</code>)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Centang apabila tanggal ini merupakan Cuti Bersama SKB 3
                  Menteri.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isJointLeave}
                onChange={(e) => setIsJointLeave(e.target.checked)}
                className="size-4 accent-primary"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Simpan Hari Libur
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
