import { createElement, isValidElement, type ElementType, type ReactNode } from "react";

export function MenuButton({
  icon,
  active,
  onClick,
  children,
}: {
  icon: ElementType<{ size?: number; className?: string }> | ReactNode;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const iconNode = isValidElement(icon) ? icon : typeof icon === "function" || (typeof icon === "object" && icon !== null)
    ? createElement(icon as ElementType<{ size?: number; className?: string }>, { size: 18, className: "shrink-0" })
    : icon;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-blue-900/30 text-blue-300"
          : "text-inherit hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      {iconNode}
      {children}
    </button>
  );
}
