"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadBill } from "@/hooks/use-upload-bill";

export default function NewBillPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadBill();

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const result = await upload.mutateAsync(file);
    router.push(`/bills/${result.bill.id}`);
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Upload invoice</h1>
          <p className="text-muted-foreground">
            Drop a PDF — we&apos;ll parse it and propose a journal entry.
          </p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>PDF upload</CardTitle>
            <CardDescription>Only PDF files are accepted right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Invoice PDF</Label>
                <Input
                  id="file"
                  type="file"
                  accept="application/pdf"
                  onChange={onFileChange}
                  required
                />
              </div>

              {upload.error && <p className="text-sm text-destructive">{upload.error.message}</p>}

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={!file || upload.isPending}>
                  <Upload className="size-4" />
                  {upload.isPending ? "Uploading…" : "Upload"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
