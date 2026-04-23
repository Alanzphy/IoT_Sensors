const ISO_OFFSET_SUFFIX = /[+-]\d{2}:\d{2}$/;

export function parseBackendTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized =
    value.endsWith("Z") || ISO_OFFSET_SUFFIX.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
