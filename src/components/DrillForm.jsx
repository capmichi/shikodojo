import { useState, useRef, useEffect } from "react";
import { callClaude, setRetryStatusHandler } from "../lib/api.js";
import { toText, parseJSON } from "../lib/util.js";
import { todayStr } from "../lib/storage.js";
import { pickTopic } from "../lib/pick.js";
import { loadDraft, saveDraft, clearDraft, hasText } from "../lib/draft.js";
import ResultPanel from "./ResultPanel.jsx";
import Answers from "./Answers.jsx";

function fieldsText(skill, answers) {
  return skill.fields.map((f) => `${f.label}：${(answers[f.id] || "").trim() || "(未記入)"}`).join("\n");
}

// 採点プロンプト。facts（例題の状況）があれば前提として渡し、
// prev（前回の回答と指摘）があれば、直せたかも一言で返させる。
function buildPrompt(skill, topic, facts, answers, prev) {
  const factsText = facts
    ? `
【状況（例題として与えた事実）】
${facts}
回答者はこの状況を前提に書いています。状況にある事実・数字を活かせているか、状況と食い違うことを書いていないかも見てください。
`
    : "";
  const axesText = skill.axes.map((a) => `- ${a.key}: ${a.desc}`).join("\n");
  const jsonKeys = skill.axes.map((a) => `"${a.key}":0`).join(",");
  const prevText = prev
    ? `

【参考：前回の回答と指摘】
このお題は前にも書いています。点数は今回の回答だけを見て、前回に引きずられず採点してください。
前回の回答：
${fieldsText(skill, prev.answers)}
前回の「次に直す」：${prev.improve}`
    : "";
  const progressKey = prev ? `,"progress":"前回の指摘を直せたかを一言"` : "";
  return `${skill.role}
以下の回答を、各軸0〜5点で厳しめに採点し、短いコメントを返してください。

【${skill.poolLabel}】${topic}
${factsText}
${fieldsText(skill, answers)}

採点軸：
${axesText}${prevText}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"scores":{${jsonKeys}},"good":"良かった点を一言","improve":"次に直す点を具体的に一言","rewrite":"${skill.rewriteInstruction}"${progressKey}}`;
}

function fmtTime(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 記録の「最終版」（書き直していれば redo、なければ1回目）
function latest(rec) {
  return rec.redo && rec.redo.answers ? rec.redo : rec;
}

// 書く系：お題＋動的フィールド＋採点。
// 1回目の採点で履歴に保存し、書き直しての再採点は同じ記録の redo を更新する
// （分析は1回目の点数で見るので、書き直しで平均が水増しされない）。
// 同じお題を前にやっていれば、その回答と指摘を見せ、採点でも比べる。
// cases のあるスキルは「例題（状況つき）」と「自分で考える（お題だけ）」を切り替えられる。
export default function DrillForm({ skill, history, addRecord, updateRecord, gotoGuide }) {
  const hasCases = !!(skill.cases && skill.cases.length);
  const listOf = (m) => (m === "case" ? skill.cases : skill.pool);
  const topicsOf = (m) => listOf(m).map((x) => (m === "case" ? x.t : x));
  // 書きかけがあれば、そのお題と入力を戻す（お題がデータから消えていたら戻さない）
  const [restored, setRestored] = useState(() => {
    const d = loadDraft(skill.id);
    if (!d || !hasText(d.vals) || !(d.mode === "case" ? hasCases : true)) return null;
    const i = topicsOf(d.mode).indexOf(d.topic);
    return i < 0 ? null : { ...d, idx: i };
  });
  const [mode, setMode] = useState(() => restored?.mode || (hasCases ? "case" : "self"));
  const [idx, setIdx] = useState(() => restored ? restored.idx : pickTopic(skill.id, topicsOf(mode), history));
  const [vals, setVals] = useState(() => restored?.vals || {});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(null);
  const [result, setResult] = useState(null);   // 直近の採点
  const [first, setFirst] = useState(null);     // 1回目の採点（比較の基準）
  const [recId, setRecId] = useState(null);     // 1回目で保存した記録のid
  const [attempt, setAttempt] = useState(0);    // 採点した回数
  const [rewriting, setRewriting] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const refBox = useRef(null);

  const list = listOf(mode);
  const item = list[idx];
  const topic = mode === "case" ? item.t : item;
  const facts = mode === "case" ? item.s : "";
  // 同じスキル・同じお題の、今回より前の記録（文章を保存しているものだけ）
  const past = history
    .filter((r) => r.skillId === skill.id && r.topic === topic && r.answers && r.id !== recId)
    .at(-1);

  // 採点前の入力は下書きとして残す（タブを移っても、アプリを閉じても消えない）
  useEffect(() => {
    if (attempt > 0) return;
    if (hasText(vals)) saveDraft(skill.id, { mode, topic, vals });
    else clearDraft(skill.id);
  }, [vals, mode, topic, attempt, skill.id]);

  function discardDraft() {
    reset();
    clearDraft(skill.id);
    setIdx(pickTopic(skill.id, topicsOf(mode), history));
  }

  function redraw() {
    reset();
    setIdx((idx + 1) % list.length);
  }

  function switchMode(m) {
    if (m === mode) return;
    reset();
    setMode(m);
    setIdx(pickTopic(skill.id, topicsOf(m), history));
  }

  function reset() {
    setResult(null);
    setFirst(null);
    setRecId(null);
    setAttempt(0);
    setRewriting(false);
    setShowPast(false);
    setRestored(null);
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
    const answers = { ...vals };
    // 比べる相手：この場の直前の採点 → なければ同じお題の前回の記録
    const prev = result
      ? { answers: result.answers, improve: result.improve }
      : past
        ? { answers: latest(past).answers, improve: latest(past).feedback?.improve || "" }
        : null;

    setLoading(true);
    setRetryStatusHandler(setRetry);
    try {
      const out = parseJSON(await callClaude(buildPrompt(skill, topic, facts, answers, prev), 1000));

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
      setShowPast(false);

      const feedback = { good: next.good, improve: next.improve, rewrite: next.rewrite, progress: next.progress };
      if (!recId) {
        // 履歴に保存（axisScores は分析の弱点傾向の元データ。answers/feedback は読み返し・前回比較用）
        const id = Date.now();
        setFirst(next);
        setRecId(id);
        setRestored(null);
        clearDraft(skill.id);
        addRecord({
          id, date: todayStr(), skillId: skill.id, skillName: skill.name,
          score: total, max, axisScores, topic, mode, answers, feedback,
        });
      } else {
        // 書き直しは1回目の記録に添えるだけ（分析には使わない）
        updateRecord(recId, { redo: { score: total, axisScores, n, answers, feedback } });
      }
    } catch (e) {
      setErr("採点に失敗しました。もう一度試してください。（" + e.message + "）");
    } finally {
      setLoading(false);
      setRetry(null);
    }
  }

  // 差を出す基準：書き直しなら1回目、初回なら同じお題の前回
  let base = null;
  if (first && result !== first) base = { label: "1回目", ...first };
  else if (result && past) {
    const [, m, d] = past.date.split("-");
    base = { label: `前回(${+m}月${+d}日)`, total: latest(past).score, max: past.max, axisScores: latest(past).axisScores };
  }

  return (
    <div>
      {hasCases && (
        <div className="modesw">
          <button className={mode === "case" ? "on" : ""} onClick={() => switchMode("case")}>
            例題<small>状況・数字つき</small>
          </button>
          <button className={mode === "self" ? "on" : ""} onClick={() => switchMode("self")}>
            自分で考える<small>お題だけ</small>
          </button>
        </div>
      )}

      <div className="titleblock">
        <div className="tb-head">
          <span>{mode === "case" ? "例題" : "No."}{String(idx + 1).padStart(2, "0")}</span>
          <span className="cat">{skill.cat}</span>
        </div>
        <div className="tb-body">
          <div className="label">{skill.poolLabel}</div>
          <div className="topic">{topic}</div>
          {facts && (
            <div className="facts">
              <div className="label">状況 ／ 用意された事実</div>
              <p>{facts}</p>
            </div>
          )}
          {hasCases && mode === "self" && (
            <div className="selfnote">状況は自分の現場を思い浮かべて補う。誰に・いつ・数字まで決めてから書くと採点が上がる。</div>
          )}
        </div>
        <div className="tb-foot">
          <button className="redraw" onClick={redraw}>↻ 引き直す</button>
        </div>
      </div>

      {restored && !result && (
        <div className="restored">
          <span>書きかけを戻しました（{fmtTime(restored.at)}）</span>
          <button onClick={discardDraft}>消して新しく</button>
        </div>
      )}

      {past && !result && (
        <div className="pastbox">
          <div className="ph">
            <span>このお題は {past.date} にも挑戦（{latest(past).score}/{past.max}）</span>
            <button onClick={() => setShowPast(!showPast)}>{showPast ? "閉じる" : "前回を見る"}</button>
          </div>
          {showPast && <Answers skill={skill} rec={latest(past)} />}
        </div>
      )}

      {facts && <div className="yours">ここから自分で考える ／ 判断と言葉は自分で</div>}

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
        <ResultPanel
          key={attempt} skill={skill} result={result} base={base} onRewrite={startRewrite}
          onGuide={gotoGuide ? (li) => gotoGuide(skill.id, li) : null}
        />
      )}
    </div>
  );
}
