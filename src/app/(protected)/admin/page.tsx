import { Suspense } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  FileText,
  Loader2,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function AdminHomeContent() {
  await requireRole(["admin_accelera", "super_admin"]);
  const supabase = await createClient();

  const [
    { count: activeVendorsCount },
    { count: userCount },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("billing_submissions")
      .select("*, vendors(name)")
      .order("received_date", { ascending: false })
      .limit(20),
  ]);

  const list = submissions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Panel Admin Accelera
          </h1>
          <p className="text-sm text-muted-foreground">
            Meja Pemeriksaan Pre-Check Softcopy, Penerimaan Fisik, Master
            Vendor, dan Manajemen Akun Pengguna.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/vendors">
            <Button variant="outline" className="gap-1.5">
              <Building2 className="size-4" />
              Kelola Master Vendor
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button className="gap-1.5">
              <Users className="size-4" />
              Kelola Akun User
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Mitra Aktif</span>
              <Building2 className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {activeVendorsCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/vendors"
              className="text-xs font-medium text-primary hover:underline"
            >
              Lihat semua data Mitra &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Akun Terdaftar</span>
              <Users className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {userCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/users"
              className="text-xs font-medium text-primary hover:underline"
            >
              Tambah akun user baru &rarr;
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Antrean Tagihan Masuk</span>
              <ClipboardCheck className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{list.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            SLA Pre-Check: 1 Hari Kerja
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Antrean Pengajuan Tagihan Mitra</CardTitle>
          <CardDescription>
            Daftar pengajuan yang masuk untuk pemeriksaan kelengkapan dokumen
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <FileText className="size-8 stroke-1" />
              <p>Belum ada dokumen pengajuan tagihan yang masuk.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Agenda</TableHead>
                  <TableHead>Nama Mitra / Vendor</TableHead>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Jenis Pekerjaan</TableHead>
                  <TableHead>Nilai (Rp)</TableHead>
                  <TableHead>Tahap</TableHead>
                  <TableHead>Status Akhir</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Diterima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => {
                  const vendorRel = row.vendors as
                    | { name?: string }
                    | Array<{ name?: string }>
                    | null
                    | undefined;
                  const vendorName = Array.isArray(vendorRel)
                    ? vendorRel[0]?.name
                    : vendorRel?.name;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link
                          href={`/mitra/submissions/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.agenda_no}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {vendorName ?? "-"}
                      </TableCell>
                      <TableCell>{row.invoice_no}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.work_type}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatRupiah(Number(row.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {STAGE_LABELS[row.current_stage]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getFinalStatusBadgeClass(row.final_status)}
                        >
                          {row.final_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getSlaStatusBadgeClass(row.sla_status)}
                        >
                          {row.sla_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeWIB(row.received_date)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Panel Admin Accelera...
        </div>
      }
    >
      <AdminHomeContent />
    </Suspense>
  );
}
