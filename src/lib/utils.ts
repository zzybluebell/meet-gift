import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function tenureYears(hireDate: Date | string): number {
  const hire = typeof hireDate === "string" ? new Date(hireDate) : hireDate;
  const now = new Date();
  const diffMs = now.getTime() - hire.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

export function genClaimCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function genQrToken(): string {
  return (
    Math.random().toString(36).slice(2, 12) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}
