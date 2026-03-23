"use client";

import { signOutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-xs font-medium text-[color-mix(in_srgb,var(--foreground)_65%,white)] hover:text-[var(--foreground)] transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
