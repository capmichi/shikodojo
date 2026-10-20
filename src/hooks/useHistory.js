import { useState, useEffect, useMemo, useCallback } from "react";
import { loadHistory, saveHistory, computeStreak, requestPersist } from "../lib/storage.js";

/* 履歴の状態＋IndexedDB永続化＋streak計算をまとめたフック */
export function useHistory() {
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(null); // 保存の保護（requestPersist の結果）

  useEffect(() => {
    loadHistory().then((h) => { setHistory(h); setReady(true); });
    requestPersist().then(setPersisted);
  }, []);

  const addRecord = useCallback(async (rec) => {
    setHistory((prev) => {
      const next = [...prev, rec];
      saveHistory(next);
      return next;
    });
  }, []);

  // id の付いた記録に追記する（書き直しの redo など）
  const updateRecord = useCallback(async (id, patch) => {
    setHistory((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      saveHistory(next);
      return next;
    });
  }, []);

  // 書き出したJSONの記録を足す。同じ記録（id、無ければ日付・スキル・点数）は足さない。
  // 返り値：{ added, skipped }
  const importRecords = useCallback(async (recs) => {
    const keyOf = (r) => (r.id != null ? `id:${r.id}` : `k:${r.date}|${r.skillId}|${r.score}|${r.max}`);
    const seen = new Set(history.map(keyOf));
    const fresh = [];
    recs.forEach((r) => {
      const k = keyOf(r);
      if (seen.has(k)) return;
      seen.add(k);
      fresh.push(r);
    });
    if (fresh.length) {
      const next = [...history, ...fresh].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)
      );
      setHistory(next);
      await saveHistory(next);
    }
    return { added: fresh.length, skipped: recs.length - fresh.length };
  }, [history]);

  const clear = useCallback(async () => {
    setHistory([]);
    await saveHistory([]);
  }, []);

  const streak = useMemo(() => computeStreak(history), [history]);

  return { history, ready, addRecord, updateRecord, importRecords, clear, streak, persisted };
}
