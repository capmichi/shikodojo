import { useState, useRef, useEffect } from "react";
import { callClaude, setRetryStatusHandler } from "../lib/api.js";
import { toText, parseJSON } from "../lib/util.js";
import { todayStr } from "../lib/storage.js";
import { pickTopic } from "../lib/pick.js";
import { gradePrompt, genPrompt } from "../lib/prompts.js";
import { loadDraft, saveDraft, clearDraft, hasText } from "../lib/draft.js";
import ResultPanel from "./ResultPanel.jsx";
import Answers from "./Answers.jsx";

function fmtTime(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 記録の「最終版」（書き直していれば redo、なければ1回目）
function latest(rec) {
  return rec.redo && rec.redo.answers ? rec.redo : rec;
}

// このスキルで使えるモードと、切替ボタンの表示
function modesOf(skill) {
  const hasCases = !!(skill.cases && skill.cases.length);
  return [
    hasCases && { key: "case", label: "例題", sub: "状況・数字つき" },
    hasCases
      ? { key: "self", label: "自分で考える", sub: "お題だけ" }
      : { key: "self", label: "練習", sub: "用意された題材" },
    skill.real && { key: "real", label: "実戦", sub: "自分の現場の話" },
  ].filter(Boolean);
}

const EMPTY_CUSTOM = { topic: "", facts: "" };

// 書く系：お題＋動的フィールド＋採点。
// モード：例題（cases：状況つき）／自分で考える（pool：お題だけ）／実戦（real：自分の現場の場面を入力）
// 例題・お題は「AIで新しく作る」でデータに無い1題を足せる（gen）。
// 1回目の採点で履歴に保存し、書き直しての再採点は同じ記録の redo を更新する
// （分析は1回目の点数で見るので、書き直しで平均が水増しされない）。
// 同じお題を前にやっていれば、その回答と指摘を見せ、採点でも比べる。
export default function DrillForm({ skill, history, addRecord, updateRecord, gotoGuide }) {
  const modes = modesOf(skill);
  const listOf = (m) => (m === "case" ? skill.cases : m === "self" ? skill.pool : []);
  const topicsOf = (m) => listOf(m).map((x) => (m === "case" ? x.t : x));

  // 書きかけがあれば、そのお題と入力を戻す（お題がデータから消えていたら戻さない）
  const [restored, setRestored] = useState(() => {
    const d = loadDraft(skill.id);
    if (!d || !modes.some((m) => m.key === d.mode)) return null;
    if (d.mode === "real") return hasText(d.vals) || hasText({ t: d.topic, f: d.facts }) ? { ...d, idx: 0 } : null;
    if (d.gen) return d.topic ? { ...d, idx: 0 } : null;
    if (!hasText(d.vals)) return null;
    const i = topicsOf(d.mode).indexOf(d.topic);
    return i < 0 ? null : { ...d, idx: i };
  });
  const [mode, setMode] = useState(() => restored?.mode || modes[0].key);
  const [idx, setIdx] = useState(() => restored ? restored.idx : pickTopic(skill.id, topicsOf(mode), history));
  const [custom, setCustom] = useState(() =>
    restored?.mode === "real" ? { topic: restored.topic || "", facts: restored.facts || "" } : EMPTY_CUSTOM
  );
  const [gen, setGen] = useState(() => restored?.gen ? { mode: restored.mode, t: restored.topic, s: restored.facts || "" } : null);
  const [genLoading, setGenLoading] = useState(false);
  const [genErr, setGenErr] = useState("");
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

  // いまのお題と状況
  let topic, facts;
  if (mode === "real") {
    topic = custom.topic.trim();
    facts = custom.facts.trim();
  } else if (gen && gen.mode === mode) {
    topic = gen.t;
    facts = gen.s;
  } else {
    const item = listOf(mode)[idx];
    topic = mode === "case" ? item.t : item;
    facts = mode === "case" ? item.s : "";
  }

  // 同じスキル・同じお題の、今回より前の記録（文章を保存しているものだけ）
  const past = topic
    ? history.filter((r) => r.skillId === skill.id && r.topic === topic && r.answers && r.id !== recId).at(-1)
    : null;

  // 採点前の入力は下書きとして残す（タブを移っても、アプリを閉じても消えない）
  useEffect(() => {
    if (attempt > 0) return;
    const real = mode === "real";
    if (gen) saveDraft(skill.id, { mode, topic: gen.t, facts: gen.s, gen: true, vals });   // AIで作ったお題は入力前でも残す
    else if (hasText(vals) || (real && hasText(custom))) {
      saveDraft(skill.id, real ? { mode, topic: custom.topic, facts: custom.facts, vals } : { mode, topic, vals });
    } else {
      clearDraft(skill.id);
    }
  }, [vals, custom, gen, mode, topic, attempt, skill.id]);

  function reset() {
    setResult(null);
    setFirst(null);
    setRecId(null);
    setAttempt(0);
    setRewriting(false);
    setShowPast(false);
    setRestored(null);
    setGen(null);
    setGenErr("");
    setErr("");
    setVals({});
  }

  function discardDraft() {
    reset();
    clearDraft(skill.id);
    setCustom(EMPTY_CUSTOM);
    setIdx(pickTopic(skill.id, topicsOf(mode), history));
  }

  function redraw() {
    reset();
    setIdx((idx + 1) % listOf(mode).length);
  }

  function switchMode(m) {
    if (m === mode) return;
    reset();
    setMode(m);
    setCustom(EMPTY_CUSTOM);
    setIdx(pickTopic(skill.id, topicsOf(m), history));
  }

  // AIに新しいお題（例題なら状況つき）を1つ作ってもらう
  async function generate() {
    setGenErr("");
    setGenLoading(true);
    try {
      const recent = history.filter((r) => r.skillId === skill.id && r.topic).slice(-10).map((r) => r.topic);
      const out = parseJSON(await callClaude(genPrompt(skill, mode, [...topicsOf(mode), ...recent]), 800));
      const t = toText(out.t).trim();
      if (!t) throw new Error("お題が空でした");
      const s = mode !== "case" ? ""
        : Array.isArray(out.s) ? out.s.map((x) => "・" + toText(x).replace(/^・\s*/, "")).join("\n")
        : toText(out.s);
      reset();
      setGen({ mode, t, s });
    } catch (e) {
      setGenErr("お題を作れませんでした。もう一度試してください。（" + e.message + "）");
    } finally {
      setGenLoading(false);
    }
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
    if (!topic) {
      setErr(`「${skill.poolLabel}」を書いてから採点してください。`);
      return;
    }
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
    const factsFrom = mode === "real" ? "real" : "case";

    setLoading(true);
    setRetryStatusHandler(setRetry);
    try {
      const out = parseJSON(await callClaude(gradePrompt(skill, { topic, facts, factsFrom }, answers, prev), 1000));

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
        // 履歴に保存（axisScores は分析の弱点傾向の元データ。answers/feedback は読み返し・前回比較用。
        // 実戦・AI作成の状況はデータに無いので facts も残す）
        const id = Date.now();
        setFirst(next);
        setRecId(id);
        setRestored(null);
        clearDraft(skill.id);
        addRecord({
          id, date: todayStr(), skillId: skill.id, skillName: skill.name,
          score: total, max, axisScores, topic, mode, answers, feedback,
          ...((mode === "real" || gen) && facts ? { facts } : {}),
          ...(gen ? { gen: true } : {}),
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

  const locked = attempt > 0; // 採点後は実戦のお題を固定（記録と食い違わないように）

  return (
    <div>
      {modes.length > 1 && (
        <div className="modesw">
          {modes.map((m) => (
            <button key={m.key} className={mode === m.key ? "on" : ""} onClick={() => switchMode(m.key)}>
              {m.label}<small>{m.sub}</small>
            </button>
          ))}
        </div>
      )}

      <div className="titleblock">
        <div className="tb-head">
          <span>
            {mode === "real" ? "実戦" : gen ? "AI作成" : (mode === "case" ? "例題" : "No.") + String(idx + 1).padStart(2, "0")}
          </span>
          <span className="cat">{skill.cat}</span>
        </div>
        {mode === "real" ? (
          <div className="tb-body">
            <div className="label">{skill.poolLabel} ／ 自分の現場</div>
            <textarea
              className="realin"
              rows={skill.real.factsPh ? 2 : 6}
              placeholder={skill.real.ph}
              value={custom.topic}
              readOnly={locked}
              onChange={(e) => setCustom({ ...custom, topic: e.target.value })}
            />
            {skill.real.factsPh && (
              <>
                <div className="label realfl">状況 ／ わかる範囲で</div>
                <textarea
                  className="realin"
                  rows={3}
                  placeholder={skill.real.factsPh}
                  value={custom.facts}
                  readOnly={locked}
                  onChange={(e) => setCustom({ ...custom, facts: e.target.value })}
                />
              </>
            )}
            <div className="selfnote">実際にあった（これからある）場面ほど身につく。人の名前は伏せてOK。</div>
          </div>
        ) : (
          <>
            <div className="tb-body">
              <div className="label">{skill.poolLabel}</div>
              <div className="topic">{topic}</div>
              {facts && (
                <div className="facts">
                  <div className="label">状況 ／ 用意された事実</div>
                  <p>{facts}</p>
                </div>
              )}
              {mode === "self" && skill.cases && (
                <div className="selfnote">状況は自分の現場を思い浮かべて補う。誰に・いつ・数字まで決めてから書くと採点が上がる。</div>
              )}
            </div>
            <div className="tb-foot">
              <button className="redraw" onClick={generate} disabled={genLoading}>
                {genLoading ? <><span className="spin" />作成中…</> : "✦ AIで新しく作る"}
              </button>
              <button className="redraw" onClick={redraw}>↻ 引き直す</button>
            </div>
            {genErr && <div className="err generr">{genErr}</div>}
          </>
        )}
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

      {(facts || mode === "real") && <div className="yours">ここから自分で考える ／ 判断と言葉は自分で</div>}

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
