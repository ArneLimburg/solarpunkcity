const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Tuesday, 1 January 2030, in UTC
const START = Date.UTC(2030, 0, 1);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// the in-game date of a week: 1 January 2030 plus 7 days per week (UTC)
function weekToDate(week: number): Date {
  return new Date(START + week * 7 * MS_PER_DAY);
}

// e.g. "1 Jan 2030"
export function formatShortDate(week: number): string {
  const date = weekToDate(week);
  const month = MONTHS[date.getUTCMonth()].slice(0, 3);
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

// e.g. "Tuesday, 1 January 2030"
export function formatLongDate(week: number): string {
  const date = weekToDate(week);
  const weekday = WEEKDAYS[date.getUTCDay()];
  const month = MONTHS[date.getUTCMonth()];
  return `${weekday}, ${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

// e.g. "0:04:07"
export function formatSessionTime(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
