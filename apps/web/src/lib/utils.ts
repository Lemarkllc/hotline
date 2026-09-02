import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Инициалы для круглых аватарок — единый хелпер (раньше был продублирован в трёх
 * местах, а Sidebar.tsx использовал собственную укороченную версию — только первая
 * буква имени, без фамилии, найдено impeccable-аудитом как несогласованность). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
