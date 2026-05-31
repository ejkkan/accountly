import { AuthView } from "@daveyplate/better-auth-ui";
import { authViewPaths } from "@daveyplate/better-auth-ui/server";

/**
 * Single catch-all route that better-auth-ui renders all of its built-in
 * views through: /auth/sign-in, /auth/sign-up, /auth/forgot-password,
 * /auth/reset-password, /auth/email-otp, /auth/two-factor, /auth/callback.
 *
 * Pre-rendering each slug at build time means hitting any of these is a
 * static-route response — better-auth-ui then mounts on the client.
 */
export function generateStaticParams(): { pathname: string }[] {
  return Object.values(authViewPaths).map((pathname) => ({ pathname }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ pathname: string }>;
}) {
  const { pathname } = await params;
  return <AuthView pathname={pathname} />;
}
