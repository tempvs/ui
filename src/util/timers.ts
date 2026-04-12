export type TimerId = ReturnType<typeof setTimeout> | number;
export type TimerRecord = Record<string, TimerId | undefined>;

export function clearTimer(record: TimerRecord, key: string): void {
  const timerId = record[key];
  if (timerId) {
    clearTimeout(timerId);
    delete record[key];
  }
}

export function clearAllTimers(record: TimerRecord): void {
  Object.values(record).forEach(timerId => {
    if (timerId) {
      clearTimeout(timerId);
    }
  });
}
