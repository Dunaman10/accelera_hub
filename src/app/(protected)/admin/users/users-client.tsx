"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  Mail,
  Power,
  Search,
  Send,
  Shield,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile, UserRole, Vendor } from "@/types";
import { formatDateWIB, ROLE_LABELS } from "@/lib/constants";
import {
  createOrInviteUserAction,
  updateUserProfileAction,
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
import { PageGuide } from "@/components/layout/page-guide";

const ALL_ROLES: UserRole[] = [
  "mitra",
  "admin_accelera",
  "pic_usaha",
  "akuntansi",
  "divisi_usaha",
  "super_admin",
];

interface UsersClientProps {
  initialProfiles: Profile[];
  vendors: Vendor[];
}

export function UsersClient({ initialProfiles, vendors }: UsersClientProps) {
  const router = useRouter();
  const [profiles, setProfiles] = React.useState<Profile[]>(initialProfiles);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<UserRole | "ALL">("ALL");

  // Modal Create / Invite User
  const [createOpen, setCreateOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("mitra");
  const [vendorId, setVendorId] = React.useState<string>("");
  const [provisioningMode, setProvisioningMode] = React.useState<
    "invite" | "create"
  >("create");
  const [password, setPassword] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Modal Edit Profile
  const [editOpen, setEditOpen] = React.useState(false);
  const [editProfile, setEditProfile] = React.useState<Profile | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editRole, setEditRole] = React.useState<UserRole>("mitra");
  const [editVendorId, setEditVendorId] = React.useState("");
  const [editActive, setEditActive] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [confirmToggleProfile, setConfirmToggleProfile] =
    React.useState<Profile | null>(null);

  const [prevInitialProfiles, setPrevInitialProfiles] =
    React.useState<Profile[]>(initialProfiles);
  if (initialProfiles !== prevInitialProfiles) {
    setPrevInitialProfiles(initialProfiles);
    setProfiles(initialProfiles);
  }

  const vendorMap = React.useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((v) => map.set(v.id, v));
    return map;
  }, [vendors]);

  const activeVendors = React.useMemo(
    () => vendors.filter((v) => v.is_active),
    [vendors]
  );

  const filteredProfiles = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== "ALL" && p.role !== roleFilter) return false;
      if (!q) return true;
      const vendorName = p.vendor_id
        ? vendorMap.get(p.vendor_id)?.name ?? ""
        : "";
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        vendorName.toLowerCase().includes(q) ||
        ROLE_LABELS[p.role].toLowerCase().includes(q)
      );
    });
  }, [profiles, searchQuery, roleFilter, vendorMap]);

  function openCreateModal() {
    setFullName("");
    setEmail("");
    setRole("mitra");
    setVendorId(activeVendors[0]?.id ?? "");
    setProvisioningMode("create");
    setPassword("");
    setCreateOpen(true);
  }

  function openEditModal(profile: Profile) {
    setEditProfile(profile);
    setEditName(profile.full_name);
    setEditRole(profile.role);
    setEditVendorId(profile.vendor_id ?? "");
    setEditActive(profile.is_active);
    setEditOpen(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (role === "mitra" && !vendorId) {
      toast.error("Pilih perusahaan Vendor / Mitra untuk akun dengan role Mitra.");
      return;
    }

    setCreating(true);
    try {
      const result = await createOrInviteUserAction({
        full_name: fullName,
        email,
        role,
        vendor_id: role === "mitra" ? vendorId : null,
        provisioning_mode: provisioningMode,
        password: provisioningMode === "create" ? password : undefined,
      });

      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal mendaftarkan user baru.");
        return;
      }

      setProfiles((prev) => [
        result.data!,
        ...prev.filter((item) => item.id !== result.data!.id),
      ]);
      toast.success(
        provisioningMode === "invite"
          ? `Undangan email telah dikirim ke ${result.data.email}.`
          : `Akun ${result.data.email} berhasil dibuat & diaktifkan.`
      );
      setCreateOpen(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editProfile) return;
    if (editRole === "mitra" && !editVendorId) {
      toast.error("Role Mitra wajib memiliki relasi Perusahaan Vendor.");
      return;
    }

    setUpdating(true);
    try {
      const result = await updateUserProfileAction({
        id: editProfile.id,
        full_name: editName,
        role: editRole,
        vendor_id: editRole === "mitra" ? editVendorId : null,
        is_active: editActive,
      });

      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal memperbarui profil.");
        return;
      }

      setProfiles((prev) =>
        prev.map((item) => (item.id === editProfile.id ? result.data! : item))
      );
      toast.success("Profil pengguna berhasil diperbarui.");
      setEditOpen(false);
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  async function handleQuickToggleActive(profile: Profile) {
    setTogglingId(profile.id);
    try {
      const nextState = !profile.is_active;
      const result = await updateUserProfileAction({
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        vendor_id: profile.vendor_id,
        is_active: nextState,
      });

      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Gagal mengubah status akun.");
        return;
      }

      setProfiles((prev) =>
        prev.map((item) => (item.id === profile.id ? result.data! : item))
      );
      toast.success(
        `Akun ${profile.full_name} diubah menjadi ${
          nextState ? "Aktif" : "Nonaktif"
        }.`
      );
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageGuide
        eyebrow="Manajemen Akses Invite-Only"
        title="Manajemen User & Hak Akses RBAC"
        purpose="Mendaftarkan akun Mitra maupun Tim Internal (Admin Accelera, PIC Usaha, Akuntansi, Divisi Usaha) secara terkendali serta mengaitkan setiap akun Mitra dengan perusahaannya."
        tip="Setiap akun role Mitra wajib memiliki relasi Perusahaan Vendor agar isolasi data (RLS) berjalan tepat."
        steps={[
          {
            title: "Siapkan Data Vendor",
            description:
              "Khusus akun Mitra, pastikan perusahaannya sudah aktif pada halaman Master Vendor.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Buat / Undang User",
            description:
              "Pilih buat akun langsung dengan password awal atau kirim undangan aktivasi lewat email.",
            badge: "Langkah 2",
          },
          {
            title: "Tetapkan Role RBAC",
            description:
              "Tentukan peran pengguna (Mitra, Admin, PIC Usaha, Akuntansi, Divisi Usaha, atau Super Admin).",
            badge: "Langkah 3",
          },
          {
            title: "Kontrol Status Aktif",
            description:
              "Ubah role, perbarui relasi vendor, atau nonaktifkan akses kapan saja langsung dari tabel.",
            badge: "Langkah 4",
          },
        ]}
        actions={
          <Button onClick={openCreateModal} size="lg" className="gap-2">
            <UserPlus className="size-4" />
            Buat / Undang User Baru
          </Button>
        }
      />

      {/* FILTER & PENCARIAN */}
      <Card>
        <CardContent className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama user, email, role, atau perusahaan Mitra..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Label htmlFor="role-filter" className="text-xs whitespace-nowrap">
              Filter Role:
            </Label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as UserRole | "ALL")
              }
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-card/70"
            >
              <option value="ALL">Semua Role ({profiles.length})</option>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* TABEL DAFTAR USER */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Daftar Akun Pengguna ({filteredProfiles.length})
          </CardTitle>
          <CardDescription>
            Setiap user dengan role <code>mitra</code> wajib terhubung ke
            <code>vendor_id</code> untuk isolasi Row Level Security (RLS).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProfiles.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tidak ditemukan akun pengguna yang cocok"
              description="Coba ubah filter role atau kata kunci pencarian nama/email."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lengkap &amp; Email</TableHead>
                  <TableHead>Role RBAC</TableHead>
                  <TableHead>Relasi Mitra (Vendor)</TableHead>
                  <TableHead>Status Akun</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => {
                  const linkedVendor = p.vendor_id
                    ? vendorMap.get(p.vendor_id)
                    : null;

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-semibold">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="size-3" />
                          {ROLE_LABELS[p.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {linkedVendor ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <Building2 className="size-3.5 text-primary" />
                            <span>{linkedVendor.name}</span>
                          </div>
                        ) : p.role === "mitra" ? (
                          <span className="text-xs font-medium text-destructive">
                            Belum terhubung ke Vendor!
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Internal Accelera
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.is_active ? (
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
                        {formatDateWIB(p.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(p)}
                            className="gap-1 text-xs"
                          >
                            <Edit3 className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant={p.is_active ? "ghost" : "secondary"}
                            size="sm"
                            disabled={togglingId === p.id}
                            onClick={() => setConfirmToggleProfile(p)}
                            className="gap-1 text-xs"
                          >
                            {togglingId === p.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Power className="size-3.5" />
                            )}
                            {p.is_active ? "Nonaktifkan" : "Aktifkan"}
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

      {/* DIALOG BUAT / INVITE USER BARU */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Daftarkan Akun Pengguna Baru</DialogTitle>
            <DialogDescription>
              Membuat akun di Supabase Auth menggunakan{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> dan menyinkronkan{" "}
              <code>profiles</code>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setProvisioningMode("create")}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                  provisioningMode === "create"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <KeyRound className="size-3.5" />
                Buat Langsung + Password
              </button>
              <button
                type="button"
                onClick={() => setProvisioningMode("invite")}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                  provisioningMode === "invite"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Send className="size-3.5" />
                Invite via Email Link
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-fullname">
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-fullname"
                required
                placeholder="Nama PIC atau Staf Internal"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-email">
                Alamat Email <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="user-email"
                  type="email"
                  required
                  placeholder="user@perusahaan.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user-role">
                  Role Pengguna <span className="text-destructive">*</span>
                </Label>
                <select
                  id="user-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-card/70"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {role === "mitra" && (
                <div className="space-y-1.5">
                  <Label htmlFor="user-vendor">
                    Perusahaan Mitra <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="user-vendor"
                    required
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-card/70"
                  >
                    <option value="">-- Pilih Perusahaan Mitra --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {!v.is_active ? "(Nonaktif)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {provisioningMode === "create" ? (
              <div className="space-y-1.5">
                <Label htmlFor="user-password">
                  Password Awal (Minimal 8 Karakter){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  User dapat langsung login dengan password ini atau menggunakan
                  OTP 6 Digit ke email mereka.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Sistem akan memanggil{" "}
                <code>supabase.auth.admin.inviteUserByEmail()</code> dan
                mengirimkan email undangan resmi agar pengguna mengatur password
                mereka sendiri.
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Memproses...
                  </>
                ) : provisioningMode === "invite" ? (
                  "Kirim Undangan Email"
                ) : (
                  "Buat Akun Sekarang"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDIT PROFIL PENGGUNA */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profil &amp; Akses Pengguna</DialogTitle>
            <DialogDescription>
              Perbarui role RBAC, penugasan vendor, atau status keaktifan untuk{" "}
              <strong>{editProfile?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fullname">Nama Lengkap</Label>
              <Input
                id="edit-fullname"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role RBAC</Label>
              <select
                id="edit-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-card/70"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {editRole === "mitra" && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-vendor">
                  Perusahaan Mitra <span className="text-destructive">*</span>
                </Label>
                <select
                  id="edit-vendor"
                  required
                  value={editVendorId}
                  onChange={(e) => setEditVendorId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-card/70"
                >
                  <option value="">-- Pilih Perusahaan Mitra --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {!v.is_active ? "(Nonaktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="text-xs font-semibold">Status Akun Aktif</p>
                <p className="text-[11px] text-muted-foreground">
                  Jika dinonaktifkan, middleware akan menolak akses pengguna.
                </p>
              </div>
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="size-4 accent-primary"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmToggleProfile !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmToggleProfile(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggleProfile?.is_active
                ? "Nonaktifkan Akun Pengguna?"
                : "Aktifkan Kembali Akun Pengguna?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggleProfile?.is_active
                ? `Pengguna "${confirmToggleProfile.full_name}" (${confirmToggleProfile.email}) tidak akan dapat mengakses portal Accelera HUB sampai diaktifkan kembali.`
                : `Pengguna "${confirmToggleProfile?.full_name}" (${confirmToggleProfile?.email}) akan kembali memiliki akses masuk sesuai rolenya.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingId !== null}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmToggleProfile?.is_active ? "destructive" : "default"
              }
              disabled={togglingId !== null}
              onClick={() => {
                if (!confirmToggleProfile) return;
                const target = confirmToggleProfile;
                setConfirmToggleProfile(null);
                void handleQuickToggleActive(target);
              }}
            >
              {confirmToggleProfile?.is_active
                ? "Ya, Nonaktifkan"
                : "Ya, Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
