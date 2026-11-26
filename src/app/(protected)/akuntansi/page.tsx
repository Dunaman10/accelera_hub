import { Suspense } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
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

async function AkuntansiContent() {
  await requireRole(["akuntansi", "super_admin"]);
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from("billing_submissions")
    .select("*")
    .order("received_date", { ascending: false })
    .limit(20);

  const list = submissions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Meja Validasi Akuntansi &amp; Perpajakan
        </h1>
        <p className="text-sm text-muted-foreground">
          Validasi kelengkapan faktur pajak, perhitungan PPN/PPh, dan penerbitan
          SPP (SLA: 2 Hari Kerja + 1 Hari Kerja SPP).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            Daftar Pengajuan Tagihan
          </CardTitle>
          <CardDescription>
            Antrean validasi pajak &amp; keuangan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada pengajuan pada antrean Akuntansi.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Agenda</TableHead>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Pekerjaan</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Tahap</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Masuk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {row.agenda_no}
                    </TableCell>
                    <TableCell>{row.invoice_no}</TableCell>
                    <TableCell>{row.work_type}</TableCell>
                    <TableCell>{formatRupiah(Number(row.amount))}</TableCell>
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
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTimeWIB(row.received_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AkuntansiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Meja Validasi Akuntansi...
        </div>
      }
    >
      <AkuntansiContent />
    </Suspense>
  );
}
