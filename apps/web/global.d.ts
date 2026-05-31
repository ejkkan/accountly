/// <reference types="@cloudflare/workers-types" />

// The backend's `Env` references Cloudflare-specific globals (R2Bucket, etc.).
// `import type { AppType } from "@accountly/backend"` resolves through the
// pnpm workspace symlink to the backend's source, so those globals need to
// exist in the web's type world too — even though no web code ever calls
// into them at runtime.
