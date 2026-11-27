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

// the in-game time of a week: 1 January 2030 plus 7 days per week (UTC)
export function weekToTime(week: number): number {
  return START + week * 7 * MS_PER_DAY;
}

function weekToDate(week: number): Date {
  return new Date(weekToTime(week));
}

// e.g. "1 Jan 2030" for a time in milliseconds (UTC)
export function formatShortTime(time: number): string {
  const date = new Date(time);
  const month = MONTHS[date.getUTCMonth()].slice(0, 3);
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}

// e.g. "1 Jan 2030"
export function formatShortDate(week: number): string {
  return formatShortTime(weekToTime(week));
}

// The birth date (UTC time) of someone who is exactly `age` years old in the
// given week, `dayOffset` (0 to 364) days before their birthday of that year.
// A 29 February birthday counts as 28 February in a year without one.
export function birthTime(
  week: number,
  age: number,
  dayOffset: number,
): number {
  const joined = weekToDate(week);
  const month = joined.getUTCMonth();
  const day = joined.getUTCDate();
  const year = joined.getUTCFullYear() - age;
  const birthday = Date.UTC(year, month, day);
  const exists = new Date(birthday).getUTCMonth() === month;
  return (
    (exists ? birthday : Date.UTC(year, month, day - 1)) -
    dayOffset * MS_PER_DAY
  );
}

// the full years between a birth date and the date of a week
export function ageInWeek(birth: number, week: number): number {
  const born = new Date(birth);
  const date = weekToDate(week);
  const month = born.getUTCMonth();
  const year = date.getUTCFullYear();
  let birthday = Date.UTC(year, month, born.getUTCDate());
  if (new Date(birthday).getUTCMonth() !== month) {
    birthday = Date.UTC(year, month, born.getUTCDate() - 1); // 29 February
  }
  const years = year - born.getUTCFullYear();
  return date.getTime() < birthday ? years - 1 : years;
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
