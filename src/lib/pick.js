/* 今日のスキル・お題の選び方
   どちらも履歴だけから決まる（同じ履歴なら同じ結果）。 */
import { dayIndex } from "./util.js";
import { todayStr } from "./storage.js";

function toDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

// 今日のスキル：苦手（平均が低い）ほど、しばらくやっていないほど優先。
// 今日の記録は計算から外すので、今日やっても「今日のスキル」は一日変わらない。
// 同点はスキルの並びを日替わりでずらして決める。
// 返り値 { skill, avg（%・未挑戦はnull）, days（前回から何日・未挑戦はnull） }
export function pickToday(skills, history, today = todayStr()) {
  const past = (history || []).filter((r) => r.date < today);
  const n = skills.length;
  const di = dayIndex();
  let best = null;
  skills.forEach((skill, i) => {
    const recs = past.filter((r) => r.skillId === skill.id && r.max > 0);
    const avg = recs.length ? recs.reduce((a, r) => a + r.score / r.max, 0) / recs.length : null;
    const last = recs.reduce((m, r) => (r.date > m ? r.date : m), "");
    const days = last ? daysBetween(last, today) : null;
    const weak = avg === null ? 0.5 : 1 - avg;                  // 0〜1
    const stale = days === null ? 1 : Math.min(days, 14) / 14;  // 0〜1（2週間で頭打ち）
    const tie = (((i - di) % n) + n) % n * 1e-4;
    const score = weak + stale - tie;
    if (!best || score > best.score) {
      best = { score, skill, avg: avg === null ? null : Math.round(avg * 100), days };
    }
  });
  return best;
}

// お題選び：まだやっていないお題を先頭から → 全部やったら、一番前にやったお題
// （同じお題に間を空けて戻ってくるので、前回比較がそのまま復習になる）
export function pickTopic(skillId, topics, history) {
  const last = {};
  (history || []).forEach((r) => {
    if (r.skillId === skillId && r.topic && (r.id || 0) >= (last[r.topic] || 0)) last[r.topic] = r.id || 0;
  });
  let best = 0;
  for (let i = 0; i < topics.length; i++) {
    if (!(topics[i] in last)) return i;
    if (last[topics[i]] < last[topics[best]]) best = i;
  }
  return best;
}
