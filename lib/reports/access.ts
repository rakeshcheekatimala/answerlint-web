export type ReportAccessMode =
  | "open"
  | "email_capture"
  | "google_login"
  | "magic_link";

export type ReportStorageMode = "disabled" | "best_effort" | "required";

export type ReportCaptureFailMode = "open" | "closed";

export type ReportAccessConfig = {
  accessMode: ReportAccessMode;
  storageMode: ReportStorageMode;
  captureFailMode: ReportCaptureFailMode;
  googleAuthEnabled: boolean;
};

type ReportAccessEnv = Partial<
  Record<
    | "NEXT_PUBLIC_REPORT_ACCESS_MODE"
    | "REPORT_STORAGE_MODE"
    | "REPORT_CAPTURE_FAIL_MODE"
    | "NEXT_PUBLIC_ENABLE_GOOGLE_AUTH",
    string
  >
>;

const ACCESS_MODES = new Set<ReportAccessMode>([
  "open",
  "email_capture",
  "google_login",
  "magic_link",
]);
const STORAGE_MODES = new Set<ReportStorageMode>([
  "disabled",
  "best_effort",
  "required",
]);
const CAPTURE_FAIL_MODES = new Set<ReportCaptureFailMode>(["open", "closed"]);

function readEnum<T extends string>(
  value: string | undefined,
  allowed: Set<T>,
  fallback: T,
) {
  return value && allowed.has(value as T) ? (value as T) : fallback;
}

export function getReportAccessConfig(
  env: ReportAccessEnv = process.env as ReportAccessEnv,
): ReportAccessConfig {
  return {
    accessMode: readEnum(
      env.NEXT_PUBLIC_REPORT_ACCESS_MODE,
      ACCESS_MODES,
      "email_capture",
    ),
    storageMode: readEnum(env.REPORT_STORAGE_MODE, STORAGE_MODES, "best_effort"),
    captureFailMode: readEnum(
      env.REPORT_CAPTURE_FAIL_MODE,
      CAPTURE_FAIL_MODES,
      "open",
    ),
    googleAuthEnabled: env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true",
  };
}

export function shouldCaptureEmail(config: ReportAccessConfig) {
  return config.accessMode === "email_capture";
}

export function shouldSendMagicLink(config: ReportAccessConfig) {
  return config.accessMode === "magic_link";
}

export function shouldRequireGoogleLogin(config: ReportAccessConfig) {
  return config.accessMode === "google_login";
}

export function canFailOpen(config: ReportAccessConfig) {
  return config.captureFailMode === "open";
}
