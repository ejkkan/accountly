"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadBill } from "@/hooks/use-upload-bill";

export default function NewBillPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadBill();

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const result = await upload.mutateAsync(file);
    router.push(`/bills/${result.bill.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop a PDF invoice. We&apos;ll parse it and propose a journal entry.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">PDF</Label>
          <Input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={onFileChange}
            required
          />
        </div>

        {upload.error && (
          <p className="text-sm text-destructive">{upload.error.message}</p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
