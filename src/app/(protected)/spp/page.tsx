import { Suspense } from "react";
import { Loader2, QrCode } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeWIB } from "@/lib/constants";
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

async function SppMonitoringContent() {
  await requireRole(["divisi_usaha", "akuntansi", "super_admin"]);
  const supabase = await createClient();

  const { data: sppList } = await supabase
    .from("spp_documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = sppList ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Monitoring &amp; Arsip SPP Digital
        </h1>
        <p className="text-sm text-muted-foreground">
          Surat Permintaan Pembayaran (SPP) terverifikasi dengan QR Code Hash
          untuk Divisi Usaha / Keuangan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-4 text-primary" />
            Dokumen SPP Terbit
          </CardTitle>
          <CardDescription>
            Daftar SPP yang telah diterbitkan oleh Akuntansi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada dokumen SPP yang diterbitkan.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. SPP</TableHead>
                  <TableHead>QR Verification Hash</TableHead>
                  <TableHead>Tanggal Terbit</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((spp) => (
                  <TableRow key={spp.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {spp.spp_no}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {spp.qr_verification_hash}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTimeWIB(spp.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {spp.notes ?? "-"}
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

export default function SppMonitoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Monitoring SPP...
        </div>
      }
    >
      <SppMonitoringContent />
    </Suspense>
  );
}
