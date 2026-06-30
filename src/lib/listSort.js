function toTime(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getRecencyTimestamp(item) {
  return toTime(item?.updatedAt || item?.createdAt);
}

export function compareByRecencyDesc(a, b) {
  return getRecencyTimestamp(b) - getRecencyTimestamp(a);
}

export function compareByRecencyAsc(a, b) {
  return getRecencyTimestamp(a) - getRecencyTimestamp(b);
}

