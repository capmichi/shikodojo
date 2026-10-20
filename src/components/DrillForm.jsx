import { useState, useRef } from "react";
import { callClaude, setRetryStatusHandler } from "../lib/api.js";
import { topicIndex, toText, parseJSON } from "../lib/util.js";
import { todayStr } from "../lib/storage.js";
import { WRITE_SKILLS } from "../lib/skills.js";
import ResultPanel from "./ResultPanel.jsx";

function fieldsText(skill, answers) {
  return skill.fields.map((f) => `${f.label}：${(answers[f.id] || "").trim() || "(未記入)"}`).join("\n");
}

// 採点プロンプト。prev（前回の回答と指摘）があれば、直せたかも一言で返させる。
function buildPrompt(skill, topic, answers, prev) {
  const axesText = skill.axes.map((a) => `- ${a.key}: ${a.desc}`).join("\n");
  const jsonKeys = skill.axes.map((a) => `"${a.key}":0`).join(",");
  const prevText = prev
    ? `

【参考：前回の回答と指摘】
この回答は、前回の指摘を受けて書き直したものです。点数は今回の回答だけを見て、前回に引きずられず採点してください。
前回の回答：
${fieldsText(skill, prev.answers)}
前回の「次に直す」：${prev.improve}`
    : "";
  const progressKey = prev ? `,"progress":"前回の指摘を直せたかを一言"` : "";
  return `${skill.role}
以下の回答を、各軸0〜5点で厳しめに採点し、短いコメントを返してください。

【${skill.poolLabel}】${topic}

${fieldsText(skill, answers)}

採点軸：
${axesText}${prevText}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"scores":{${jsonKeys}},"good":"良かった点を一言","improve":"次に直す点を具体的に一言","rewrite":"${skill.rewriteInstruction}"${progressKey}}`;
}

// 書く系：お題＋動的フィールド＋採点。
// 1回目の採点で履歴に保存し、書き直しての再採点は同じ記録の redo を更新する
// （分析は1回目の点数で見るので、書き直しで平均が水増しされない）。
export default function DrillForm({ skill, addRecord, updateRecord }) {
  const initIdx = topicIndex(skill.pool.length, WRITE_SKILLS.length);
  const [idx, setIdx] = useState(initIdx);
  const [vals, setVals] = useState({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(null);
  const [result, setResult] = useState(null);   // 直近の採点
  const [first, setFirst] = useState(null);     // 1回目の採点（比較の基準）
  const [recId, setRecId] = useState(null);     // 1回目で保存した記録のid
  const [attempt, setAttempt] = useState(0);    // 採点した回数
  const [rewriting, setRewriting] = useState(false);
  const refBox = useRef(null);

  function redraw() {
    setIdx((idx + 1) % skill.pool.length);
    setResult(null);
    setFirst(null);
    setRecId(null);
    setAttempt(0);
    setRewriting(false);
    setErr("");
    setVals({});
  }

  function setField(id, v) {
    setVals((prev) => ({ ...prev, [id]: v }));
  }

  function startRewrite() {
    setRewriting(true);
    setTimeout(() => refBox.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
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
    const answers = { ...vals };
    const prev = result ? { answers: result.answers, improve: result.improve } : null;

    setLoading(true);
    setRetryStatusHandler(setRetry);
    try {
      const out = parseJSON(await callClaude(buildPrompt(skill, topic, answers, prev), 1000));

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

      const next = {
        axisScores,
        total,
        max,
        answers,
        good: toText(out.good),
        improve: toText(out.improve),
        rewrite: toText(out.rewrite),
        progress: prev ? toText(out.progress) : "",
      };
      const n = attempt + 1;
      setResult(next);
      setAttempt(n);
      setRewriting(false);

      if (!recId) {
        // 履歴に保存（axisScores は分析の弱点傾向の元データ）
        const id = Date.now();
        setFirst(next);
        setRecId(id);
        addRecord({ id, date: todayStr(), skillId: skill.id, skillName: skill.name, score: total, max, axisScores });
      } else {
        // 書き直しは1回目の記録に添えるだけ（分析には使わない）
        updateRecord(recId, { redo: { score: total, axisScores, n } });
      }
    } catch (e) {
      setErr("採点に失敗しました。もう一度試してください。（" + e.message + "）");
    } finally {
      setLoading(false);
      setRetry(null);
    }
  }

  const base = first && result !== first ? { label: "1回目", ...first } : null;

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

      {rewriting && result && (
        <div className="refbox" ref={refBox}>
          <div className="rh">前回の指摘を見ながら書き直す</div>
          <div className="ri"><b>次に直す</b><p>{result.improve}</p></div>
          {result.rewrite && <div className="ri"><b>{skill.rewriteLabel}</b><p>{result.rewrite}</p></div>}
        </div>
      )}

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
        {loading ? <><span className="spin" />{retry || "採点中…"}</> : attempt ? `再採点する（${attempt + 1}回目）` : "採点する"}
      </button>
      {err && <div className="err">{err}</div>}

      {result && (
        <ResultPanel key={attempt} skill={skill} result={result} base={base} onRewrite={startRewrite} />
      )}
    </div>
  );
}
