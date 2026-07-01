import { useState, useEffect } from "react";
import { SKILLS } from "../lib/skills.js";
import { GROUPS, AXIS_GROUP } from "../lib/groups.js";
import { callClaude } from "../lib/api.js";

// 分析：①弱点の傾向（3グループ平均）②推移 ③スキル別平均 ④AI総括
export default function Analysis({ history }) {
  const writeRecs = history.filter((r) => r.axisScores); // 書く系のみ
  const [mounted, setMounted] = useState(false);
  const [aiOut, setAiOut] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (writeRecs.length < 2) {
    return (
      <div className="view">
        <div className="hempty">記録が少ないと分析できません。書く系スキルを何回かやってみましょう。</div>
      </div>
    );
  }

  // ① グループ横断の平均
  const acc = { depth: [], concrete: [], delivery: [] };
  writeRecs.forEach((r) => {
    for (const k in r.axisScores) {
      const g = AXIS_GROUP[k];
      if (g) acc[g].push(r.axisScores[k] / 5);
    }
  });
  const gpct = {};
  for (const g in acc) gpct[g] = acc[g].length ? Math.round(acc[g].reduce((a, b) => a + b, 0) / acc[g].length * 100) : null;
  const valid = Object.keys(gpct).filter((g) => gpct[g] !== null);
  const lowG = valid.slice().sort((a, b) => gpct[a] - gpct[b])[0];

  // ② 推移（直近12回、書く＋クイズ全部、％）
  const all = history.slice(-12);

  // ③ スキル別平均
  const skillRows = SKILLS.map((s) => {
    const recs = history.filter((r) => r.skillId === s.id);
    if (!recs.length) return null;
    const avg = Math.round(recs.reduce((a, r) => a + r.score / r.max, 0) / recs.length * 100);
    return { s, avg, n: recs.length };
  }).filter(Boolean);

  async function aiSummary() {
    const perSkill = SKILLS.map((s) => {
      const r = history.filter((x) => x.skillId === s.id);
      if (!r.length) return null;
      return `${s.name}：平均${Math.round(r.reduce((a, x) => a + x.score / x.max, 0) / r.length * 100)}%（${r.length}回）`;
    }).filter(Boolean).join("\n");
    const acc2 = { depth: [], concrete: [], delivery: [] };
    history.filter((r) => r.axisScores).forEach((r) => {
      for (const k in r.axisScores) { const g = AXIS_GROUP[k]; if (g) acc2[g].push(r.axisScores[k] / 5); }
    });
    const gtxt = Object.keys(GROUPS).map((g) => acc2[g].length ? `${GROUPS[g]}：${Math.round(acc2[g].reduce((a, b) => a + b, 0) / acc2[g].length * 100)}%` : null).filter(Boolean).join("、");
    const prompt =
`あなたは思考トレーニングのコーチです。ユーザーの練習記録から、傾向と次の一手を温かく簡潔にまとめてください。説教くさくせず、励ましつつ具体的に。

■ 3つの力の平均
${gtxt}

■ スキル別の平均
${perSkill}

次の3点を、各1〜2文で：
1. 強み（一番できている所）
2. 共通の伸びしろ（一番低い力と、それが何を意味するか）
3. 次の一手（具体的に何をやるとよいか）

JSON等は不要。短い日本語の文章だけで返してください。`;
    setAiLoading(true);
    try {
      const text = await callClaude(prompt, 600);
      setAiOut(text.trim() || "うまく取得できませんでした。もう一度お試しください。");
    } catch (e) {
      setAiOut("総括の取得に失敗しました。（" + e.message + "）");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="view">
      <div className="gridlabel">弱点の傾向 ／ どの力が足りないか</div>
      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 2px 12px", lineHeight: 1.6 }}>
        スキルをまたいで、3つの力の平均を出しています。一番低いものが、あなたの“共通の伸びしろ”です。
        <span style={{ color: "var(--muted-2)" }}>（傾向のヒントとして。これが全てではありません）</span>
      </p>
      <div>
        {valid.map((g) => {
          const cls = g === lowG ? "gbig low" : (gpct[g] >= 70 ? "gbig hi" : "gbig");
          return (
            <div className={cls} key={g}>
              <div className="gt"><span>{GROUPS[g]}</span><b>{gpct[g]}%</b></div>
              <div className="gbar"><div className="gfill" style={{ width: (mounted ? gpct[g] : 0) + "%" }} /></div>
            </div>
          );
        })}
      </div>
      <div className="weak" style={{ marginTop: "14px" }}>
        <b>共通の伸びしろ：{GROUPS[lowG]}（{gpct[lowG]}%）</b> — どのスキルでも、この力が足を引っぱりがち。各スキルの教本で、この観点のレッスンを意識して読むと効きます。
      </div>

      <div className="gridlabel" style={{ marginTop: "24px" }}>点数の推移 ／ 伸びているか</div>
      <div className="trendwrap">
        <div className="trendbars">
          {all.map((r, i) => (
            <div className="tbar" key={i} style={{ height: (mounted ? Math.round(r.score / r.max * 100) : 0) + "%" }} />
          ))}
        </div>
        <div className="trendx">
          <span>{all[0].date.slice(5)}</span>
          <span>最新 {all[all.length - 1].date.slice(5)}</span>
        </div>
      </div>

      <div className="gridlabel" style={{ marginTop: "24px" }}>スキル別の平均 ／ Skill</div>
      <div>
        {skillRows.map(({ s, avg, n }) => (
          <div className="anrow" key={s.id}>
            <span>
              <span className="ab" style={{ width: Math.max(6, avg * 0.6) + "px" }} />
              {s.name}<span style={{ color: "var(--muted-2)", fontSize: "11px" }}> ×{n}</span>
            </span>
            <span className="av">{avg}%</span>
          </div>
        ))}
      </div>

      <button className="grade" style={{ marginTop: "22px" }} onClick={aiSummary} disabled={aiLoading}>
        {aiLoading ? <><span className="spin" />分析中…</> : "AIに総括してもらう"}
      </button>
      {aiOut && (
        <div className="airesult">
          <div className="ah">AIの総括</div>
          <p>{aiOut}</p>
        </div>
      )}
    </div>
  );
}
