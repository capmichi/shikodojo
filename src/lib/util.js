/* 小さな共有ユーティリティ */

// 日替わりローテ用のインデックス（叩き台HTMLと同じ基準日）
export function dayIndex() {
  const start = new Date(2024, 0, 1);
  return Math.floor((new Date() - start) / 86400000);
}

// AIが文字列でなくオブジェクト/配列で返しても読める形に整える
// （HTMLで修正済みの [object Object] バグ対策。必ず表示前に通す）
export function toText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join("\n");
  if (typeof v === "object") return Object.entries(v).map(([k, val]) => `${k}：${toText(val)}`).join("\n");
  return String(v);
}

// あるスキルの平均％（max>0 のレコードのみ）
export function skillAvg(history, id) {
  const recs = (history || []).filter((r) => r.skillId === id && r.max > 0);
  if (!recs.length) return null;
  const pct = recs.reduce((s, r) => s + r.score / r.max, 0) / recs.length;
  return Math.round(pct * 100);
}
