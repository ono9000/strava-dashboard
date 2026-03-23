import { LogoutButton } from "@/components/LogoutButton";

interface NavBarProps {
  email: string;
}

export function NavBar({ email }: NavBarProps) {
  return (
    <header className="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_90%,white)] px-5 py-3 sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <p className="display-font text-base font-semibold text-[var(--accent-strong)]">
          Axial Day
        </p>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-[color-mix(in_srgb,var(--foreground)_60%,white)] sm:block">
            {email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
