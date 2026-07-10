"use client";

import { signOut } from "@/actions/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  return (
    <DropdownMenuItem asChild>
      <form action={signOut} className="w-full">
        <button
          type="submit"
          className="w-full cursor-default text-left text-destructive"
        >
          Sign out
        </button>
      </form>
    </DropdownMenuItem>
  );
}
