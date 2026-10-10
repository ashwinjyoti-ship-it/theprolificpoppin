"use client";

import { SessionProvider } from "next-auth/react";

export default function ReaderSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/api/reader-auth">{children}</SessionProvider>;
}
