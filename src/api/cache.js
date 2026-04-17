const CACHE_TTL = 60_000;

export function createCachedAccessor(prefix) {
  const cache = new Map();

  function makeKey(parts = []) {
    return `${prefix}:${JSON.stringify(parts)}`;
  }

  function get(parts) {
    const key = makeKey(parts);
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL) {
      cache.delete(key);
      return null;
    }
    return hit.value;
  }

  function set(parts, value) {
    cache.set(makeKey(parts), { at: Date.now(), value });
    return value;
  }

  function clear() {
    cache.clear();
  }

  return { get, set, clear };
}

