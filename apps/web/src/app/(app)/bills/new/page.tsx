"use client";

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUploadBill } from "@/hooks/use-upload-bill";

const MAX_BYTES = 10 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewBillPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { upload, isUploading } = useUploadBill();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function pickFile(next: File | null) {
    setFileError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.type !== "application/pdf") {
      setFile(null);
      setFileError("That doesn't look like a PDF. Try a different file.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setFileError(`That file is ${fmtSize(next.size)} — Accountly accepts up to 10 MB.`);
      return;
    }
    setFile(next);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0] ?? null);
  }
  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || isUploading) return;
    try {
      const { billId } = await upload(file);
      qc.invalidateQueries({ queryKey: ["bills"] });
      router.push(`/bills/${billId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Upload invoice</h1>
          <p className="text-muted-foreground">
            Drop a PDF — Accountly AI reads it and proposes a balanced journal entry.
          </p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6">
        <Card className="mx-auto max-w-xl">
          {isUploading ? (
            <AnalyzingState fileName={file?.name ?? "your invoice"} />
          ) : (
            <>
              <CardHeader>
                <CardTitle>PDF upload</CardTitle>
                <CardDescription>Only PDF files are accepted right now.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    }`}
                  >
                    <FileText className="size-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">
                      {isDragging ? "Drop to attach" : "Drag a PDF here, or click to browse"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">PDF only · max 10 MB</p>
                    <input
                      id="file"
                      type="file"
                      accept="application/pdf"
                      onChange={onFileChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>

                  {fileError && (
                    <p className="text-sm text-destructive" role="alert">
                      {fileError}
                    </p>
                  )}

                  {file && (
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{file.name}</span>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtSize(file.size)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={!file}>
                      <Upload className="size-4" />
                      Upload
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => router.back()}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

/**
 * Shown while `POST /api/bills` runs end-to-end (store → parse → persist,
 * ~10s). It's an honest indeterminate state — the model produces nothing
 * observable until it's done reading the PDF, so we don't fake per-token
 * progress. On success the page redirects to the bill.
 */
function AnalyzingState({ fileName }: { fileName: string }) {
  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-base">Analyzing your invoice</CardTitle>
            <CardDescription className="truncate">{fileName}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Reading the PDF and proposing a journal entry — this takes a few seconds.
        </div>
      </CardContent>
    </>
  );
}
