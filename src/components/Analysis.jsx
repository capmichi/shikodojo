import { useState, useEffect } from "react";
import { SKILLS } from "../lib/skills.js";
import { GROUPS, AXIS_GROUP } from "../lib/groups.js";
import { lessonForAxis } from "../lib/guides.js";
import { callClaude } from "../lib/api.js";
import GroupTrend from "./GroupTrend.jsx";

// あるグループに属する軸を「スキル×軸」で平均し、低い順に（教本レッスン付き）
function weakAxesIn(group, writeRecs) {
  const acc = {};
  writeRecs.forEach((r) => {
    for (const k in r.axisScores) {
      if (AXIS_GROUP[k] !== group) continue;
      const id = `${r.skillId}:${k}`;
      (acc[id] = acc[id] || []).push(r.axisScores[k] / 5);
    }
  });
  return Object.entries(acc)
    .map(([id, arr]) => {
      const [skillId, key] = id.split(":");
      const skill = SKILLS.find((s) => s.id === skillId);
      const axis = skill && skill.axes.find((a) => a.key === key);
      if (!axis) return null;
      const pct = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100);
      return { skill, axis, pct, lesson: lessonForAxis(skillId, key) };
    })
    .filter(Boolean)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);
}

// 記録の「最終版」の指摘（書き直していれば redo のもの）
function lastImprove(r) {
  return (r.redo && r.redo.feedback ? r.redo.feedback : r.feedback || {}).improve || "";
}

// 分析：①弱点の傾向（3グループ平均・力ごとの推移）②点数の推移 ③スキル別平均 ④AI総括
export default function Analysis({ history, gotoGuide }) {
  const writeRecs = history.filter((r) => r.axisScores); // 書く系のみ
  const quizRecs = history.filter((r) => r.groupRates);  // 分野別の正答率を持つクイズ
  const [mounted, setMounted] = useState(false);
  const [aiOut, setAiOut] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (writeRecs.length + quizRecs.length < 2) {
    return (
      <div className="view">
        <div className="hempty">記録が少ないと分析できません。書く系スキルやクイズを何回かやってみましょう。</div>
      </div>
    );
  }

  // ① グループ横断の平均（書く系は軸ごと、クイズは1回ごとに分野別の正答率を1つ）
  const acc = { depth: [], concrete: [], delivery: [] };
  writeRecs.forEach((r) => {
    for (const k in r.axisScores) {
      const g = AXIS_GROUP[k];
      if (g) acc[g].push(r.axisScores[k] / 5);
    }
  });
  quizRecs.forEach((r) => {
    for (const g in r.groupRates) if (acc[g]) acc[g].push(r.groupRates[g]);
  });
  const gpct = {};
  for (const g in acc) gpct[g] = acc[g].length ? Math.round(acc[g].reduce((a, b) => a + b, 0) / acc[g].length * 100) : null;
  const valid = Object.keys(gpct).filter((g) => gpct[g] !== null);
  const lowG = valid.slice().sort((a, b) => gpct[a] - gpct[b])[0];
  const weakAxes = weakAxesIn(lowG, writeRecs);

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
    const gtxt = valid.map((g) => `${GROUPS[g]}：${gpct[g]}%`).join("、");
    // 直近の「次に直す」（新しい順に8件）。点数だけでは見えない、繰り返す癖を拾わせる
    const improves = writeRecs
      .filter((r) => lastImprove(r))
      .slice(-8)
      .reverse()
      .map((r) => `- [${r.skillName}] ${lastImprove(r)}`)
      .join("\n");
    const prompt =
`あなたは思考トレーニングのコーチです。ユーザーの練習記録から、傾向と次の一手を温かく簡潔にまとめてください。説教くさくせず、励ましつつ具体的に。

■ 3つの力の平均
${gtxt}

■ スキル別の平均
${perSkill}
${improves ? `
■ 直近の採点で受けた「次に直す」（新しい順）
${improves}
` : ""}
次の3点を、各1〜2文で：
1. 強み（一番できている所）
2. 共通の伸びしろ（一番低い力と、それが何を意味するか。直近の指摘に繰り返し出ている癖があれば、それも）
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
        スキルをまたいで（クイズの正答率も含めて）、3つの力の平均を出しています。一番低いものが、あなたの“共通の伸びしろ”です。
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
      {weakAxes.length > 0 && (
        <div className="weakaxes">
          <div className="gh">{GROUPS[lowG]}の中で、特に低い軸</div>
          {weakAxes.map(({ skill, axis, pct, lesson }) => (
            <div className="wa" key={skill.id + axis.key}>
              <div className="wl"><span>{skill.name}・{axis.label}</span><b>{pct}%</b></div>
              {lesson && gotoGuide && (
                <button onClick={() => gotoGuide(skill.id, lesson.idx)}>📖 {lesson.t}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {history.filter((r) => r.axisScores || r.groupRates).length >= 3 && (
        <>
          <div className="gridlabel" style={{ marginTop: "24px" }}>3つの力の推移 ／ 直近5回の平均</div>
          <GroupTrend history={history} />
        </>
      )}

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
