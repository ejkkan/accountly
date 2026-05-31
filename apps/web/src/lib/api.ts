import { readError } from "./errors";

/**
 * The structural subset of the hc client's `ClientResponse<T>` that we
 * actually touch. Hono's type isn't a full DOM `Response` (it's missing
 * `webSocket`, etc.), so accepting `Response & {...}` wouldn't match.
 */
type UnwrapableResponse<T> = {
  ok: boolean;
  status: number;
  json(): Promise<T>;
  text(): Promise<string>;
};

/**
 * Unwrap a Hono RPC call. Takes the `Promise<ClientResponse<T>>` the typed
 * client returns and either gives back the parsed body (typed as `T`) or
 * throws `ApiError`.
 *
 * Keeps every hook to a single line:
 *
 *   queryFn: () => unwrap(api.api.bills.$get()),
 *
 * The `T` flows from the route's `c.json(...)` through hc's inference
 * straight into react-query's `data` field. No manual types anywhere.
 */
export async function unwrap<T>(promise: Promise<UnwrapableResponse<T>>): Promise<T> {
  const res = await promise;
  if (!res.ok) {
    // readError expects a full Response — we hand it a structural cast.
    // hc's client response carries the same json/status surface in practice.
    throw await readError(res as unknown as Response);
  }
  return res.json();
}
