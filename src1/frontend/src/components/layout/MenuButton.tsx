import { type ReactNode } from "react";

export function MenuButton({
  icon,
  label,
  value,
  page,
  setPage,
  dark,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  page: string;
  setPage: (p: string) => void;
  dark: boolean;
}) {
  const active = page === value;
  return (
    <button
      onClick={() => setPage(value)}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? dark
            ? "bg-blue-900/30 text-blue-300"
            : "bg-blue-50 text-blue-700"
          : dark
            ? "text-gray-300 hover:bg-gray-800"
            : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
