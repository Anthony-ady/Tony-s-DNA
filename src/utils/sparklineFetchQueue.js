/**
 * Global concurrency limit for sparkline / daily-series fetches on dashboard cards.
 * Avoids N parallel Druid (or similar) calls when many EntityPerformanceCards mount at once.
 */
const MAX_CONCURRENT_SPARK_FETCHES = 3;

let active = 0;
const queue = [];

function pump() {
  while (active < MAX_CONCURRENT_SPARK_FETCHES && queue.length > 0) {
    const item = queue.shift();
    active += 1;
    Promise.resolve()
      .then(() => item.run())
      .then(item.resolve, item.reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

/**
 * @param {() => Promise<unknown>} run
 * @returns {Promise<unknown>}
 */
export function enqueueSparklineFetch(run) {
  return new Promise((resolve, reject) => {
    queue.push({ run, resolve, reject });
    pump();
  });
}
