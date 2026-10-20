/* 小さな共有ユーティリティ */

// 日替わりローテ用のインデックス（叩き台HTMLと同じ基準日）
export function dayIndex() {
  const start = new Date(2024, 0, 1);
  return Math.floor((new Date() - start) / 86400000);
}

// 日替わりのお題index。スキルも同じ dayIndex で回るので、お題まで dayIndex の剰余にすると
// 「今日のスキル」の日に出るお題が偏る（6スキル×10題なら5題しか出ない）。
// 「今日のスキルとして何周目か」で進めると、全お題が順番に回る。
export function topicIndex(len, cycle) {
  const k = Math.floor(dayIndex() / cycle);
  return ((k % len) + len) % len;
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
