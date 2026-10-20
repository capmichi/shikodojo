import { useState } from "react";
import { callClaude, setRetryStatusHandler } from "../lib/api.js";
import { topicIndex, toText } from "../lib/util.js";
import { todayStr } from "../lib/storage.js";
import { WRITE_SKILLS } from "../lib/skills.js";
import ResultPanel from "./ResultPanel.jsx";

// 書く系：お題＋動的フィールド＋採点。プロンプト組み立ては叩き台HTMLの grade() と同一。
export default function DrillForm({ skill, addRecord }) {
  const initIdx = topicIndex(skill.pool.length, WRITE_SKILLS.length);
  const [idx, setIdx] = useState(initIdx);
  const [vals, setVals] = useState({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(null);
  const [result, setResult] = useState(null);

  function redraw() {
    setIdx((idx + 1) % skill.pool.length);
    setResult(null);
    setErr("");
    setVals({});
  }

  function setField(id, v) {
    setVals((prev) => ({ ...prev, [id]: v }));
  }

  async function grade() {
    setErr("");
    // 必須チェック
    for (const f of skill.fields) {
      const v = (vals[f.id] || "").trim();
      if (f.required && !v) {
        setErr(`「${f.label}」だけは埋めてから採点してください。`);
        return;
      }
    }
    const topic = skill.pool[idx];
    const fieldsText = skill.fields.map((f) => `${f.label}：${(vals[f.id] || "").trim() || "(未記入)"}`).join("\n");
    const axesText = skill.axes.map((a) => `- ${a.key}: ${a.desc}`).join("\n");
    const jsonKeys = skill.axes.map((a) => `"${a.key}":0`).join(",");
    const prompt =
`${skill.role}
以下の回答を、各軸0〜5点で厳しめに採点し、短いコメントを返してください。

【${skill.poolLabel}】${topic}

${fieldsText}

採点軸：
${axesText}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"scores":{${jsonKeys}},"good":"良かった点を一言","improve":"次に直す点を具体的に一言","rewrite":"${skill.rewriteInstruction}"}`;

    setLoading(true);
    setRetryStatusHandler(setRetry);
    try {
      let text = await callClaude(prompt, 1000);
      text = text.replace(/```json|```/g, "").trim();
      const out = JSON.parse(text);

      // スコア整形＋合計＋軸別
      const s = out.scores || {};
      let total = 0;
      const axisScores = {};
      skill.axes.forEach((a) => {
        const val = Math.max(0, Math.min(5, Number(s[a.key]) || 0));
        total += val;
        axisScores[a.key] = val;
      });
      const max = skill.axes.length * 5;

      setResult({
        axisScores,
        total,
        max,
        good: toText(out.good),
        improve: toText(out.improve),
        rewrite: toText(out.rewrite),
      });

      // 履歴に保存（axisScores は分析の弱点傾向の元データ）
      addRecord({ date: todayStr(), skillId: skill.id, skillName: skill.name, score: total, max, axisScores });
    } catch (e) {
      setErr("採点に失敗しました。もう一度試してください。（" + e.message + "）");
    } finally {
      setLoading(false);
      setRetry(null);
    }
  }

  return (
    <div>
      <div className="titleblock">
        <div className="tb-head">
          <span>No.{String(idx + 1).padStart(2, "0")}</span>
          <span className="cat">{skill.cat}</span>
        </div>
        <div className="tb-body">
          <div className="label">{skill.poolLabel}</div>
          <div className="topic">{skill.pool[idx]}</div>
        </div>
        <div className="tb-foot">
          <button className="redraw" onClick={redraw}>↻ 引き直す</button>
        </div>
      </div>

      <div>
        {skill.fields.map((f) => (
          <div className="field" key={f.id}>
            <div className="fl">{f.required && <b>必須</b>}{f.label}</div>
            {f.sub && <div className="fs">{f.sub}</div>}
            <textarea
              placeholder={f.ph || ""}
              value={vals[f.id] || ""}
              onChange={(e) => setField(f.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      <button className="grade" onClick={grade} disabled={loading}>
        {loading ? <><span className="spin" />{retry || "採点中…"}</> : "採点する"}
      </button>
      {err && <div className="err">{err}</div>}

      {result && <ResultPanel skill={skill} result={result} />}
    </div>
  );
}
