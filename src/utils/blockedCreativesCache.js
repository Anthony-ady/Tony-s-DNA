/**
 * Blocked creatives list cache: localStorage for small/medium payloads,
 * IndexedDB when localStorage throws (QuotaExceeded) — large lists.
 */

export const BLOCKED_CREATIVES_CACHE_TTL_MS = 60 * 60 * 1000;

const LS_KEY = "edy_blocked_creatives_cache_v1";
const IDB_NAME = "edy_bo_blocked_creatives";
const IDB_STORE = "data";
const IDB_VER = 1;
const IDB_KEY = "items";

const POINTER_FLAG = "_idb";
const MAX_LS_ATTEMPT_BYTES = 4 * 1024 * 1024; // try IDB if JSON would be huge

function isFresh(cachedAt, ttlMs) {
  return Date.now() - cachedAt < ttlMs;
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, IDB_VER);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(IDB_STORE)) {
        r.result.createObjectStore(IDB_STORE, { keyPath: "k" });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbGetItems() {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(IDB_STORE, "readonly");
    const req = t.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => {
      const row = req.result;
      resolve(row?.items ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbSetItems(items) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(IDB_STORE, "readwrite");
    t.objectStore(IDB_STORE).put({ k: IDB_KEY, items });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function idbClear() {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const t = db.transaction(IDB_STORE, "readwrite");
      t.objectStore(IDB_STORE).delete(IDB_KEY);
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
    });
  } catch {
    /* no-op */
  }
}

/**
 * Synchronous read of localStorage (inline list or idb pointer only).
 * @param {number} ttlMs
 * @returns {null | { kind: 'inline', items: any[], cachedAt: number } | { kind: 'pointer', cachedAt: number, itemCount: number }}
 */
export function readBlockedCreativesCacheMeta(ttlMs) {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p[POINTER_FLAG] === true && typeof p.cachedAt === "number" && p.itemCount != null) {
      if (!isFresh(p.cachedAt, ttlMs)) return null;
      return { kind: "pointer", cachedAt: p.cachedAt, itemCount: p.itemCount };
    }
    if (Array.isArray(p.items) && typeof p.cachedAt === "number") {
      if (!isFresh(p.cachedAt, ttlMs)) return null;
      return { kind: "inline", items: p.items, cachedAt: p.cachedAt };
    }
  } catch {
    /* */
  }
  return null;
}

/**
 * @returns {Promise<any[]|null>}
 */
export async function readBlockedCreativesItemsFromIdb() {
  try {
    return await idbGetItems();
  } catch (e) {
    console.warn("Blocked creatives: IDB read failed", e);
    return null;
  }
}

/**
 * @param {any[]} items
 * @param {string} onIdbMessage - optional, for toast
 * @returns {Promise<'inline' | 'idb' | 'none'>} where the list was written
 */
export async function writeBlockedCreativesCache(items) {
  const cachedAt = Date.now();
  let payload;
  try {
    payload = JSON.stringify({ cachedAt, items });
  } catch (e) {
    console.warn("Blocked creatives: cannot stringify cache", e);
    return "none";
  }

  if (typeof localStorage === "undefined") {
    return "none";
  }

  /* Prefer inline in localStorage if small enough */
  if (payload.length <= MAX_LS_ATTEMPT_BYTES) {
    try {
      localStorage.setItem(LS_KEY, payload);
      await idbClear();
      return "inline";
    } catch (e) {
      if (e?.name !== "QuotaExceededError" && e?.code !== 22) {
        try {
          localStorage.removeItem(LS_KEY);
        } catch {
          /* */
        }
        return "none";
      }
    }
  }

  /* IDB for large or quota on LS */
  try {
    await idbSetItems(items);
    const pointer = JSON.stringify({
      [POINTER_FLAG]: true,
      cachedAt,
      itemCount: items.length,
    });
    try {
      localStorage.setItem(LS_KEY, pointer);
    } catch (e) {
      console.warn("Blocked creatives: cannot write idb pointer to localStorage", e);
      return "none";
    }
    return "idb";
  } catch (e) {
    console.warn("Blocked creatives: IDB write failed", e);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* */
    }
    return "none";
  }
}

/**
 * @returns {boolean} true if anything was in ls for this app (after invalidation)
 */
export function clearBlockedCreativesCache() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* */
  }
  return idbClear();
}
