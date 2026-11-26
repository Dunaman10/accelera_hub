"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  Search,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { UserRole, Vendor } from "@/types";
import { formatDateWIB } from "@/lib/constants";
import {
  deleteVendorAction,
  saveVendorAction,
  toggleVendorActiveAction,
} from "./actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { EmptyState } from "@/components/ui/empty-state";
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
import { Textarea } from "@/components/ui/textarea";
import { PageGuide } from "@/components/layout/page-guide";

interface VendorsClientProps {
  initialVendors: Vendor[];
  currentUserRole: UserRole;
}

export function VendorsClient({
  initialVendors,
  currentUserRole,
}: VendorsClientProps) {
  const router = useRouter();
  const [vendors, setVendors] = React.useState<Vendor[]>(initialVendors);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  // Modal Form State
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [npwp, setNpwp] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [picName, setPicName] = React.useState("");
  const [whatsappNumber, setWhatsappNumber] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmToggleVendor, setConfirmToggleVendor] =
    React.useState<Vendor | null>(null);
  const [confirmDeleteVendor, setConfirmDeleteVendor] =
    React.useState<Vendor | null>(null);

  React.useEffect(() => {
    setVendors(initialVendors);
  }, [initialVendors]);

  const filteredVendors = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vendors.filter((v) => {
      if (statusFilter === "ACTIVE" && !v.is_active) return false;
      if (statusFilter === "INACTIVE" && v.is_active) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.npwp ?? "").toLowerCase().includes(q) ||
        (v.pic_name ?? "").toLowerCase().includes(q) ||
        (v.email ?? "").toLowerCase().includes(q) ||
        (v.whatsapp_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [vendors, searchQuery, statusFilter]);

  function openCreateDialog() {
    setEditingId(null);
    setName("");
    setNpwp("");
    setAddress("");
    setPicName("");
    setWhatsappNumber("");
    setEmail("");
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEditDialog(vendor: Vendor) {
    setEditingId(vendor.id);
    setName(vendor.name);
    setNpwp(vendor.npwp ?? "");
    setAddress(vendor.address ?? "");
    setPicName(vendor.pic_name ?? "");
    setWhatsappNumber(vendor.whatsapp_number ?? "");
    setEmail(vendor.email ?? "");
    setIsActive(vendor.is_active);
    setDialogOpen(true);
  }

  async function handleSaveVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama perusahaan Mitra wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveVendorAction({
        id: editingId ?? undefined,
        name,
        npwp,
        address,
        pic_name: picName,
        whatsapp_number: whatsappNumber,
        email,
        is_active: isActive,
      });

      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal menyimpan data Mitra.");
        return;
      }

      if (editingId) {
        setVendors((prev) =>
          prev.map((v) => (v.id === editingId ? result.data! : v))
        );
        toast.success("Data Mitra berhasil diperbarui.");
      } else {
        setVendors((prev) => [result.data!, ...prev]);
        toast.success("Mitra baru berhasil ditambahkan.");
      }

      setDialogOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(vendor: Vendor) {
    setTogglingId(vendor.id);
    try {
      const nextState = !vendor.is_active;
      const result = await toggleVendorActiveAction(vendor.id, nextState);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal mengubah status aktif Mitra.");
        return;
      }

      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? result.data! : v))
      );
      toast.success(
        `Status ${vendor.name} diubah menjadi ${
          nextState ? "Aktif" : "Nonaktif"
        }.`
      );
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteVendor(vendor: Vendor) {
    setDeletingId(vendor.id);
    try {
      const result = await deleteVendorAction(vendor.id);
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menghapus Mitra.");
        return;
      }

      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      toast.success(`Mitra "${vendor.name}" telah dihapus.`);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageGuide
        eyebrow="Pengaturan Master Data"
        title="Master Data Vendor / Mitra"
        purpose="Direktori resmi perusahaan Mitra yang menjadi dasar pendaftaran akun, validasi NPWP/perpajakan, dan kontak WhatsApp/Email tindak lanjut SLA penagihan."
        tip="Daftarkan perusahaan Mitra terlebih dahulu di sini sebelum membuat akun login Mitra pada menu Manajemen User."
        steps={[
          {
            title: "Tambah Data Mitra",
            description:
              "Klik Tambah Mitra Baru lalu lengkapi Nama Perusahaan, NPWP, dan alamat resmi.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Isi Kontak PIC & WA",
            description:
              "Simpan nama PIC, nomor WhatsApp, dan email agar tombol follow-up WA & notifikasi berjalan otomatis.",
            badge: "Langkah 2",
          },
          {
            title: "Kaitkan Akun User",
            description:
              "Buka menu Manajemen User untuk membuat akun login Mitra yang terhubung ke perusahaan ini.",
            badge: "Langkah 3",
          },
          {
            title: "Kelola Status Aktif",
            description:
              "Nonaktifkan Mitra bila kerja sama berakhir agar tidak dapat membuat pengajuan tagihan baru.",
            badge: "Langkah 4",
          },
        ]}
        actions={
          <Button onClick={openCreateDialog} size="lg" className="gap-2">
            <Plus className="size-4" />
            Tambah Mitra Baru
          </Button>
        }
      />

      {/* FILTER & SEARCH BAR */}
      <Card>
        <CardContent className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama perusahaan, NPWP, nama PIC, WhatsApp, atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={statusFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("ALL")}
            >
              Semua ({vendors.length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "ACTIVE" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("ACTIVE")}
            >
              Aktif ({vendors.filter((v) => v.is_active).length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "INACTIVE" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("INACTIVE")}
            >
              Nonaktif ({vendors.filter((v) => !v.is_active).length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TABEL DAFTAR VENDOR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Daftar Perusahaan Mitra ({filteredVendors.length})
          </CardTitle>
          <CardDescription>
            Mitra yang berstatus Nonaktif tidak dapat dipilih untuk pengajuan
            baru
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredVendors.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Tidak ada data Mitra yang cocok"
              description="Coba ubah filter status aktif/nonaktif atau kata kunci pencarian Anda."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Perusahaan &amp; Alamat</TableHead>
                  <TableHead>NPWP</TableHead>
                  <TableHead>PIC &amp; Kontak</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="max-w-xs whitespace-normal">
                      <div className="font-semibold text-foreground">
                        {vendor.name}
                      </div>
                      {vendor.address && (
                        <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2">{vendor.address}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {vendor.npwp || "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="space-y-0.5 text-xs">
                        {vendor.pic_name && (
                          <div className="flex items-center gap-1.5 font-medium">
                            <User className="size-3 text-muted-foreground" />
                            <span>{vendor.pic_name}</span>
                          </div>
                        )}
                        {vendor.whatsapp_number && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="size-3" />
                            <span>{vendor.whatsapp_number}</span>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="size-3" />
                            <span>{vendor.email}</span>
                          </div>
                        )}
                        {!vendor.pic_name &&
                          !vendor.whatsapp_number &&
                          !vendor.email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.is_active ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="size-3" />
                          Aktif
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-muted-foreground/30 bg-muted text-muted-foreground"
                        >
                          <XCircle className="size-3" />
                          Nonaktif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateWIB(vendor.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(vendor)}
                          className="gap-1 text-xs"
                        >
                          <Edit3 className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant={vendor.is_active ? "ghost" : "secondary"}
                          size="sm"
                          disabled={togglingId === vendor.id}
                          onClick={() => setConfirmToggleVendor(vendor)}
                          className="gap-1 text-xs"
                        >
                          {togglingId === vendor.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Power className="size-3.5" />
                          )}
                          {vendor.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        {currentUserRole === "super_admin" && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            disabled={deletingId === vendor.id}
                            onClick={() => setConfirmDeleteVendor(vendor)}
                            title="Hapus Mitra"
                          >
                            {deletingId === vendor.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DIALOG FORM CREATE / EDIT VENDOR */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Perbarui Data Mitra" : "Tambah Mitra / Vendor Baru"}
            </DialogTitle>
            <DialogDescription>
              Lengkapi informasi profil perusahaan Mitra untuk keperluan
              verifikasi tagihan &amp; notifikasi SLA.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVendor} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-name">
                Nama Perusahaan Mitra <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vendor-name"
                required
                placeholder="PT Contoh Mitra Sejahtera"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vendor-npwp">NPWP Perusahaan</Label>
                <Input
                  id="vendor-npwp"
                  placeholder="00.000.000.0-000.000"
                  value={npwp}
                  onChange={(e) => setNpwp(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vendor-pic">Nama PIC Mitra</Label>
                <Input
                  id="vendor-pic"
                  placeholder="Budi Santoso"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vendor-wa">Nomor WhatsApp PIC</Label>
                <Input
                  id="vendor-wa"
                  placeholder="081234567890"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vendor-email">Email Resmi / PIC</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="finance@mitra.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor-address">Alamat Lengkap</Label>
              <Textarea
                id="vendor-address"
                rows={2}
                placeholder="Jl. Jend. Sudirman Kav. 10, Jakarta"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="text-xs font-semibold">Status Aktif Mitra</p>
                <p className="text-[11px] text-muted-foreground">
                  Aktifkan agar akun Mitra perusahaan ini dapat mengajukan
                  tagihan.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
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
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : editingId ? (
                  "Simpan Perubahan"
                ) : (
                  "Simpan Mitra"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmToggleVendor !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmToggleVendor(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggleVendor?.is_active
                ? "Nonaktifkan Mitra / Vendor?"
                : "Aktifkan Kembali Mitra / Vendor?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggleVendor?.is_active
                ? `Mitra "${confirmToggleVendor.name}" tidak akan dapat membuat pengajuan tagihan baru selama berstatus Nonaktif.`
                : `Mitra "${confirmToggleVendor?.name}" akan diaktifkan kembali untuk pengajuan tagihan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingId !== null}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirmToggleVendor?.is_active ? "destructive" : "default"}
              disabled={togglingId !== null}
              onClick={() => {
                if (!confirmToggleVendor) return;
                const target = confirmToggleVendor;
                setConfirmToggleVendor(null);
                void handleToggleActive(target);
              }}
            >
              {confirmToggleVendor?.is_active
                ? "Ya, Nonaktifkan"
                : "Ya, Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteVendor !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteVendor(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Permanen Mitra?</AlertDialogTitle>
            <AlertDialogDescription>
              Mitra <strong>{confirmDeleteVendor?.name}</strong> akan dihapus
              secara permanen. Pastikan belum ada pengajuan tagihan terkait
              pada Mitra ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletingId !== null}
              onClick={() => {
                if (!confirmDeleteVendor) return;
                const target = confirmDeleteVendor;
                setConfirmDeleteVendor(null);
                void handleDeleteVendor(target);
              }}
            >
              Ya, Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
