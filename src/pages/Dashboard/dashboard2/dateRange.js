export function getTimeRange() {
  return localStorage.getItem('selected-time-range') || '7d';
}

export function calculateDatesFromTimeRange(range) {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  let startDateValue;
  let endDateValue;

  switch (range) {
    case '5d': {
      const date5d = new Date(todayYear, todayMonth, todayDate - 5);
      startDateValue = new Date(Date.UTC(date5d.getFullYear(), date5d.getMonth(), date5d.getDate(), 0, 0, 0, 0));
      endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      break;
    }
    case '14d': {
      const date14d = new Date(todayYear, todayMonth, todayDate - 14);
      startDateValue = new Date(Date.UTC(date14d.getFullYear(), date14d.getMonth(), date14d.getDate(), 0, 0, 0, 0));
      endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      break;
    }
    case '20d': {
      const date20d = new Date(todayYear, todayMonth, todayDate - 20);
      startDateValue = new Date(Date.UTC(date20d.getFullYear(), date20d.getMonth(), date20d.getDate(), 0, 0, 0, 0));
      endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      break;
    }
    case '30d': {
      const date30d = new Date(todayYear, todayMonth, todayDate - 30);
      startDateValue = new Date(Date.UTC(date30d.getFullYear(), date30d.getMonth(), date30d.getDate(), 0, 0, 0, 0));
      endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      break;
    }
    case '7d':
    default: {
      const date7d = new Date(todayYear, todayMonth, todayDate - 7);
      startDateValue = new Date(Date.UTC(date7d.getFullYear(), date7d.getMonth(), date7d.getDate(), 0, 0, 0, 0));
      endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    }
  }

  return {
    start: startDateValue.toISOString().split('T')[0],
    end: endDateValue.toISOString().split('T')[0],
  };
}

export function getPreviousPeriod(start, end) {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  const dayCount = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
  const prevEndMs = startMs - 24 * 60 * 60 * 1000;
  const prevStartMs = prevEndMs - (dayCount - 1) * 24 * 60 * 60 * 1000;

  return {
    start: new Date(prevStartMs).toISOString().split('T')[0],
    end: new Date(prevEndMs).toISOString().split('T')[0],
    dayCount,
  };
}

export function toUtcInterval(start, end) {
  return {
    begin: new Date(`${start}T00:00:00.000Z`),
    end: new Date(`${end}T23:59:59.999Z`),
  };
}

/** Network ops data is nightly — exclude today when end date is today or later. */
export function getNetworkOpsInterval(start, end) {
  const { begin, end: endDateValue } = toUtcInterval(start, end);
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  if (endDateValue >= todayStart) {
    const yesterdayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));
    const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));

    if (begin >= todayStart) {
      return null;
    }

    return { begin, end: yesterdayEnd };
  }

  return { begin, end: endDateValue };
}

export function getYesterdayDateStr() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .split('T')[0];
}

export function countInclusiveDays(start, end) {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
}

export function countNetworkOpsDays(start, end) {
  const interval = getNetworkOpsInterval(start, end);
  if (!interval) return 1;
  const startMs = interval.begin.getTime();
  const endMs = interval.end.getTime();
  return Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1);
}

export function cleanTimestamp(timestamp) {
  if (!timestamp) return null;
  let clean = timestamp.replace(/\.\d{6}/g, '');
  if (!clean.endsWith('Z') && !clean.includes('+')) {
    clean += 'Z';
  }
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date;
}
