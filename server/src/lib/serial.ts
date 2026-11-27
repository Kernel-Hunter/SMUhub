/**
 * Runs `fn` after every earlier call with the same key has settled, so parallel requests cannot all pass a check
 * (a cap, a count) before any of them writes. Keys are namespaced by the caller, e.g. `xp:<user>`, `post:<user>`.
 * Holds for a single server process only: several instances would need a transaction or a counter document.
 * Never nest two calls with the same key: the inner one would wait for the outer one forever.
 */
const queues = new Map<string, Promise<unknown>>()

export function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(key) ?? Promise.resolve()).then(fn, fn)
  const tail = run.then(() => {}, () => {})
  queues.set(key, tail)
  void tail.then(() => { if (queues.get(key) === tail) queues.delete(key) })
  return run
}
