"use client";

import { SignOutControl } from "@/components/auth/sign-out-control";

/** @deprecated Use SignOutControl directly */
export function SignOutButton() {
  return <SignOutControl variant="menu" />;
}
