export function isBusinessScanEnabled() {
  const value =
    process.env.NEXT_PUBLIC_ENABLE_BUSINESS_SCAN ??
    process.env.ENABLE_BUSINESS_SCAN;

  return value?.trim().toLowerCase() !== "false";
}
