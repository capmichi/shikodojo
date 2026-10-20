/* 小さな共有ユーティリティ */

// 基準日からの日数（今日のスキルの同点を日替わりでずらすのに使う）
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

// AIの返答からJSONオブジェクトを取り出す。「以下が採点です」等の前置きや
// コードブロックが付いても、最初の { から最後の } までを読む。
export function parseJSON(text) {
  const s = String(text || "").replace(/```json|```/g, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("採点結果を読み取れませんでした");
  return JSON.parse(s.slice(a, b + 1));
}

// あるスキルの平均％（max>0 のレコードのみ）
export function skillAvg(history, id) {
  const recs = (history || []).filter((r) => r.skillId === id && r.max > 0);
  if (!recs.length) return null;
  const pct = recs.reduce((s, r) => s + r.score / r.max, 0) / recs.length;
  return Math.round(pct * 100);
}
