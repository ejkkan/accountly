/**
 * Money is stored as minor units (öre for SEK) in the DB and on the wire —
 * BigInt-shaped strings, since postgres `bigint` columns serialise that way
 * through the pg driver. This module is the single place we parse/format.
 *
 * No floats anywhere. No `Number(x) / 100` shortcuts. Use BigInt for any
 * arithmetic, format only at the edges.
 */

const LOCALE_BY_CURRENCY: Record<string, string> = {
  SEK: "sv-SE",
  EUR: "de-DE",
  USD: "en-US",
};

/**
 * Format a minor-unit amount (e.g. 11687500) as a currency string
 * ("116 875,00 kr"). Accepts the bigint-as-string shape we get from JSON.
 */
export function formatMinor(minor: string | number | bigint, currency = "SEK"): string {
  const asBigInt = typeof minor === "bigint" ? minor : BigInt(minor);
  // 1/100th: integer-divide for whole units, modulo for the cents.
  const whole = asBigInt / 100n;
  const cents = (asBigInt < 0n ? -asBigInt : asBigInt) % 100n;
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US";

  const wholeStr = new Intl.NumberFormat(locale).format(whole);
  const centsStr = cents.toString().padStart(2, "0");
  // sv-SE uses ',' as decimal separator; let Intl carry that through by
  // formatting a tiny known number and reading the decimal.
  const decimalSep = (1.1).toLocaleString(locale).replace(/\d/g, "");

  return `${wholeStr}${decimalSep}${centsStr} ${currency}`;
}
