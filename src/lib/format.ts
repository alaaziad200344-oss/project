export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
