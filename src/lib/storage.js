/* IndexedDB ラッパー（他アプリと統一）
   DB名 shikodojo / ストア history。
   レコード数は知れているので、配列を1キー("all")でまるごと持つ簡易方式。 */

const DB_NAME = "shikodojo";
const STORE = "history";
const KEY = "all";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadHistory() {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        const v = req.result;
        if (!v) return resolve([]);
        try {
          // 文字列でも配列でも受けられるように
          resolve(Array.isArray(v) ? v : JSON.parse(v));
        } catch (e) {
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

export async function saveHistory(arr) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(arr, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    return false;
  }
}

/* ── 日付ユーティリティ・streak（HTMLの computeStreak を移植） ── */
export function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function computeStreak(history) {
  const days = [...new Set((history || []).map((r) => r.date))].sort();
  if (!days.length) return 0;
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  // 今日が無ければ昨日から数える（その日まだやってなくても連続は途切れない）
  if (!set.has(todayStr())) d.setDate(d.getDate() - 1);
  while (true) {
    const s =
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
    if (set.has(s)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
