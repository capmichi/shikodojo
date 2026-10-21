/* 書きかけの下書き（スキルごとに1つ）。localStorage キー "shikodojo:drafts"
   { [skillId]: { mode, topic, facts?, vals, at } }
   端末ごとの便利機能なので、読めない・消えていても練習はそのまま動く。 */

const KEY = "shikodojo:drafts";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) { /* 保存できなくても練習は続けられる */ }
}

export function loadDraft(skillId) {
  return readAll()[skillId] || null;
}

export function saveDraft(skillId, draft) {
  const all = readAll();
  all[skillId] = { ...draft, at: Date.now() };
  writeAll(all);
}

export function clearDraft(skillId) {
  const all = readAll();
  if (!(skillId in all)) return;
  delete all[skillId];
  writeAll(all);
}

// 端末ごとの小さな設定（制限時間など）。localStorage キー "shikodojo:pref:<name>"
export function loadPref(name, fallback) {
  try {
    const v = localStorage.getItem("shikodojo:pref:" + name);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

export function savePref(name, value) {
  try {
    localStorage.setItem("shikodojo:pref:" + name, JSON.stringify(value));
  } catch (e) { /* 保存できなくても動く */ }
}

// 入力が1文字でもあるか
export function hasText(vals) {
  return Object.values(vals || {}).some((v) => (v || "").trim());
}
