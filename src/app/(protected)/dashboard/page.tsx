import { Suspense } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  Clock,
  FolderKanban,
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

async function SuperAdminDashboardContent() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [
    { count: vendorCount },
    { count: userCount },
    { data: submissions },
  ] = await Promise.all([
    supabase.from("vendors").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("billing_submissions")
      .select("*, vendors(name)")
      .order("received_date", { ascending: false })
      .limit(10),
  ]);

  const rows = submissions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Executive Dashboard (Super Admin)
          </h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan ekosistem Mitra, pengguna, dan antrean verifikasi dokumen
            penagihan Accelera HUB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/vendors">
            <Button variant="outline" className="gap-1.5">
              <Building2 className="size-4" />
              Master Vendor
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button className="gap-1.5">
              <Users className="size-4" />
              Manajemen User
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Total Mitra Terdaftar</span>
              <Building2 className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {vendorCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Perusahaan Mitra &amp; Vendor di Master Data
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Total Akun Pengguna</span>
              <Users className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {userCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Akun Mitra &amp; Tim Internal (Invite-Only)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Pengajuan Terbaru</span>
              <Clock className="size-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{rows.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Target SLA Internal Maksimal 6 Hari Kerja
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daftar Pengajuan Tagihan Terbaru</CardTitle>
            <CardDescription>
              10 pengajuan terakhir lintas seluruh Mitra
            </CardDescription>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ClipboardCheck className="size-3.5" />
              Meja Pemeriksaan
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <FolderKanban className="size-8 stroke-1" />
              <p>Belum ada pengajuan tagihan yang masuk.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Agenda</TableHead>
                  <TableHead>Nama Mitra / Vendor</TableHead>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Nilai Tagihan</TableHead>
                  <TableHead>Tahap Saat Ini</TableHead>
                  <TableHead>Status Akhir</TableHead>
                  <TableHead>Status SLA</TableHead>
                  <TableHead>Tanggal Masuk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const vendorRel = item.vendors as
                    | { name?: string }
                    | Array<{ name?: string }>
                    | null
                    | undefined;
                  const vendorName = Array.isArray(vendorRel)
                    ? vendorRel[0]?.name
                    : vendorRel?.name;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link
                          href={`/mitra/submissions/${item.id}`}
                          className="text-primary hover:underline"
                        >
                          {item.agenda_no}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {vendorName ?? "-"}
                      </TableCell>
                      <TableCell>{item.invoice_no}</TableCell>
                      <TableCell className="font-medium">
                        {formatRupiah(Number(item.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {STAGE_LABELS[item.current_stage]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getFinalStatusBadgeClass(item.final_status)}
                        >
                          {item.final_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getSlaStatusBadgeClass(item.sla_status)}
                        >
                          {item.sla_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTimeWIB(item.received_date)}
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

export default function SuperAdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Executive Dashboard...
        </div>
      }
    >
      <SuperAdminDashboardContent />
    </Suspense>
  );
}
