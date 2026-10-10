import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";

/**
 * Reader auth for Talk to Mr. Poppin (Google + email magic link).
 * Kept on basePath /api/reader-auth so /api/auth/login|logout (admin) stay untouched.
 *
 * Why Auth.js + Resend + pg adapter:
 * - First-class Google OAuth and Resend magic-link providers
 * - Postgres adapter works with Neon via DATABASE_URL
 * - Session cookies stay on this site; no new paid infra beyond Resend email
 */

declare global {
  // eslint-disable-next-line no-var
  var __tpp_auth_pool: Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }
  if (!globalThis.__tpp_auth_pool) {
    globalThis.__tpp_auth_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return globalThis.__tpp_auth_pool;
}

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const resendConfigured = Boolean(process.env.AUTH_RESEND_KEY);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(getPool()),
  basePath: "/api/reader-auth",
  trustHost: true,
  session: { strategy: "database" },
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(resendConfigured
      ? [
          Resend({
            apiKey: process.env.AUTH_RESEND_KEY!,
            from: process.env.AUTH_EMAIL_FROM || "Mr. Poppin <onboarding@resend.dev>",
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/talk-to-mr-poppin",
    verifyRequest: "/talk-to-mr-poppin?magic=sent",
    error: "/talk-to-mr-poppin?authError=1",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

export function readerAuthProviders() {
  return {
    google: googleConfigured,
    email: resendConfigured,
  };
}
