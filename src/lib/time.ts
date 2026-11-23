/** Asia/Shanghai is UTC+8 year-round (no DST). */

export const SHANGHAI_TZ = "Asia/Shanghai";

export function formatShanghaiInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function parseShanghaiInput(value: string) {
  if (!value) return new Date();
  const normalized = value.length === 16 ? `${value}:00` : value;
  return new Date(`${normalized}+08:00`);
}

export function formatShanghaiDisplay(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatShanghaiInputSec(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (ty: string) => parts.find((p) => p.type === ty)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}

/** Start of a Shanghai calendar day as a Date. */
export function shanghaiDayStart(base = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const g = (ty: string) => parts.find((p) => p.type === ty)?.value ?? "00";
  return new Date(`${g("year")}-${g("month")}-${g("day")}T00:00:00+08:00`);
}

export function addShanghaiDays(date: Date, days: number) {
  const shifted = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  // date is already an instant; adding 24h is correct even across TZ because Shanghai has no DST
  return shifted;
}

export function defaultDashboardRange() {
  const endDay = shanghaiDayStart(new Date());
  const start = new Date(endDay.getTime() - 6 * 24 * 60 * 60 * 1000);
  const end = new Date(endDay.getTime() + 24 * 60 * 60 * 1000 - 1000);
  return { start, end };
}
