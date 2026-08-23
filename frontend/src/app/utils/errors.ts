export function getErrorMessage(error: any, fallback: string): string {
  const errorDetail = error?.response?.data?.detail;
  if (typeof errorDetail === "string") {
    return errorDetail;
  }
  if (Array.isArray(errorDetail)) {
    return errorDetail.map((item: any) => item.msg || JSON.stringify(item)).join(", ");
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}