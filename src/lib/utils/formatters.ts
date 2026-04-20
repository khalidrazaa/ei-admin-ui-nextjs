export function formatCompactNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatFixedNumber(
  value: number | null | undefined,
  maximumFractionDigits = 1
): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatMultiplier(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0x";
  }

  return `${formatFixedNumber(value, value < 10 ? 2 : 1)}x`;
}

export function formatHours(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0h";
  }

  if (value >= 24) {
    return `${formatFixedNumber(value / 24, 1)}d`;
  }

  return `${formatFixedNumber(value, value < 10 ? 1 : 0)}h`;
}

export function formatRelativeTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [
    { unit: "year", seconds: 60 * 60 * 24 * 365 },
    { unit: "month", seconds: 60 * 60 * 24 * 30 },
    { unit: "week", seconds: 60 * 60 * 24 * 7 },
    { unit: "day", seconds: 60 * 60 * 24 },
    { unit: "hour", seconds: 60 * 60 },
    { unit: "minute", seconds: 60 },
  ] as const;

  for (const range of ranges) {
    if (Math.abs(diffSeconds) >= range.seconds) {
      return formatter.format(
        Math.round(diffSeconds / range.seconds),
        range.unit
      );
    }
  }

  return formatter.format(diffSeconds, "second");
}
