/**
 * Mirror of the backend's AppError on the wire. Every failed API call ends
 * up as one of these; react-query exposes it as the `error` field on hooks.
 *
 * `code` is the same stable slug the backend emits — use it when the UI
 * wants to branch on a specific failure mode (e.g. "show a help link if
 * code === 'parse_not_an_invoice'"). `message` is the human-facing string
 * that goes straight into a toast.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Turn a failed `Response` into a typed `ApiError`. Tolerant of bodies
 * that don't follow the contract (returns a generic ApiError instead of
 * throwing again), which matters for early-fail cases like 502s coming
 * straight from a proxy.
 */
export async function readError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
      };
    };
    return new ApiError(
      res.status,
      body.error?.code ?? "unknown",
      body.error?.message ?? `Request failed (${res.status})`,
      body.error?.fields
    );
  } catch {
    return new ApiError(res.status, "unknown", `Request failed (${res.status})`);
  }
}
