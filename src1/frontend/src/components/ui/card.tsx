import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-800 bg-gray-900 shadow",
        className,
      )}
      {...props}
    />
  );
}

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return (
    <div
      className={cn(
        "p-4 text-sm text-gray-100 flex flex-col gap-2",
        className,
      )}
      {...props}
    />
  );
}

