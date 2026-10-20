import { useState, useEffect, useMemo, useCallback } from "react";
import { loadHistory, saveHistory, computeStreak } from "../lib/storage.js";

/* 履歴の状態＋IndexedDB永続化＋streak計算をまとめたフック */
export function useHistory() {
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadHistory().then((h) => { setHistory(h); setReady(true); });
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

  const clear = useCallback(async () => {
    setHistory([]);
    await saveHistory([]);
  }, []);

  const streak = useMemo(() => computeStreak(history), [history]);

  return { history, ready, addRecord, updateRecord, clear, streak };
}
