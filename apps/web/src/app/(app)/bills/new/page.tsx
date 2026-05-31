"use client";

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUploadBill } from "@/hooks/use-upload-bill";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Format a byte count as human-readable. Keeps two significant digits for KB+
 * so 116 875 bytes reads as "114 KB" not "114.135 KB".
 */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewBillPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const upload = useUploadBill();

  function pickFile(next: File | null) {
    setFileError(null);
    if (!next) {
      setFile(null);
      return;
    }
    // The native file input lets anything through if the user bypasses the
    // accept hint via "All Files"; guard at our boundary so the toast text
    // is friendly instead of the server's 400.
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
    const dropped = e.dataTransfer.files?.[0] ?? null;
    pickFile(dropped);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      const result = await upload.mutateAsync(file);
      router.push(`/bills/${result.bill.id}`);
    } catch {
      // Global MutationCache toast handles it; stay on the form so the
      // user can pick another file or retry.
    }
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
          {upload.isPending ? (
            <ParsingState fileName={file?.name ?? "your invoice"} />
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

                    {/* The native input fills the dropzone so clicking anywhere
                        opens the picker, but stays invisible so we can style the
                        surrounding affordance ourselves. */}
                    <input
                      id="file"
                      type="file"
                      accept="application/pdf"
                      onChange={onFileChange}
                      required
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
 * Card body shown for the ~10–15s the LLM is reading the PDF. The backend
 * runs upload → R2 → parse → DB in a single request, so we can't show real
 * per-phase progress from the client; instead we show what we *do* know
 * (the filename) and set an honest time expectation.
 */
function ParsingState({ fileName }: { fileName: string }) {
  return (
    <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-6 text-primary" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">Our AI is reading your invoice</h2>
        <p className="text-sm text-muted-foreground">
          Working through <span className="font-medium text-foreground">{fileName}</span> —
          typically takes 10–15 seconds.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span>Uploading · extracting line items · mapping to BAS accounts</span>
      </div>
    </CardContent>
  );
}
