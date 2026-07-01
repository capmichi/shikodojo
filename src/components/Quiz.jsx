import { useState, useMemo } from "react";
import { QUIZ_SKILL } from "../lib/skills.js";
import { todayStr } from "../lib/storage.js";

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const MARKS = ["A", "B", "C", "D"];

// クイズ：タブを開くと即スタート。シャッフル出題→即時◯✕＋解説→最後にスコア。
export default function Quiz({ addRecord, gotoGuide }) {
  const questions = QUIZ_SKILL.questions;
  const [order, setOrder] = useState(() => shuffle([...Array(questions.length).keys()]));
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null); // 選んだ選択肢index（未回答はnull）
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);

  const q = questions[order[qi]];
  const ok = picked !== null && picked === q.a;

  function restart() {
    setOrder(shuffle([...Array(questions.length).keys()]));
    setQi(0); setScore(0); setPicked(null); setFinished(false); setSaved(false);
  }

  function answer(i) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.a) setScore((s) => s + 1);
  }

  function next() {
    if (qi + 1 >= order.length) {
      setFinished(true);
      if (!saved) {
        addRecord({ date: todayStr(), skillId: QUIZ_SKILL.id, skillName: QUIZ_SKILL.name, score, max: order.length });
        setSaved(true);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setQi(qi + 1);
    setPicked(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const finalMsg = useMemo(() => {
    const pct = score / order.length;
    if (pct === 1) return "満点。見抜く力は仕上がっています。次は書く側を。";
    if (pct >= 0.7) return "上々。間違えた問題の解説を教本で確認しておくと固まります。";
    return "ここが伸びしろ。間違えた分野の教本を読み直してもう一度どうぞ。";
  }, [finished]); // eslint-disable-line

  return (
    <div className="view">
      <div className="drillbar">
        <span className="gridlabel" style={{ margin: 0 }}>思考クイズ ／ 見抜く力</span>
        <button className="guidebtn" onClick={() => gotoGuide("quiz")}>📖 教本</button>
      </div>

      {finished ? (
        <div className="qresult">
          <div className="big">{score}<small>/{order.length}</small></div>
          <div className="msg">{finalMsg}</div>
          <button onClick={restart}>もう一度</button>
        </div>
      ) : (
        <div>
          <div className="quiz-top">
            <span>Q{qi + 1} / {order.length}</span>
            <span>正解 <b>{score}</b></span>
          </div>
          <div className="qcard">
            <div className="qcat">{q.cat}</div>
            <div className="qtext">{q.q}</div>
          </div>
          <div className="qopts">
            {q.opts.map((opt, i) => {
              let cls = "qopt";
              if (picked !== null) {
                if (i === q.a) cls += " correct";
                if (i === picked && i !== q.a) cls += " wrong";
              }
              return (
                <button key={i} className={cls} disabled={picked !== null} onClick={() => answer(i)}>
                  <span className="mk">{MARKS[i]}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className={"qexp " + (ok ? "ok" : "ng")}>
              <div className="eh">{ok ? "正解" : "不正解"}</div>
              <p>{q.exp}</p>
              <div className="ref"><b>関連：</b>{q.ref}</div>
            </div>
          )}
          {picked !== null && (
            <button className="qnext" onClick={next}>
              {qi + 1 >= order.length ? "結果を見る →" : "次の問題 →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
