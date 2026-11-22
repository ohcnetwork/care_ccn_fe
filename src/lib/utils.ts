import { type ClassValue, clsx } from "clsx";
import dayjs from "dayjs";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DATE_FORMAT = "DD/MM/YYYY";
const DATE_TIME_FORMAT = "hh:mm A; DD/MM/YYYY";

/** Same output as the host's `formatDateTime`, so dates read alike across CARE. */
export function formatDateTime(date: dayjs.ConfigType, format?: string) {
  const value = dayjs(date);
  if (format) return value.format(format);
  if (value.isSame(value.startOf("day"))) return value.format(DATE_FORMAT);
  return value.format(DATE_TIME_FORMAT);
}
