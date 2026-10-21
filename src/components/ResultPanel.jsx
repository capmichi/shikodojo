import { useEffect, useState } from "react";
import { lessonForAxis } from "../lib/guides.js";

// 低い軸（3点以下）から順に、それを鍛える教本レッスンを最大2つ
function weakLessons(skill, axisScores) {
  const links = [];
  const weak = skill.axes
    .map((a) => ({ a, val: axisScores[a.key] ?? 0 }))
    .filter((x) => x.val <= 3)
    .sort((x, y) => x.val - y.val);
  for (const { a } of weak) {
    const l = lessonForAxis(skill.id, a.key);
    if (l && !links.some((x) => x.idx === l.idx)) links.push({ ...l, label: a.label });
    if (links.length >= 2) break;
  }
  return links;
}

// 採点結果：ゲージ（軸別）＋教本リンク＋良かった点/次に直す/お手本。
// good/improve/rewrite/progress は DrillForm 側で toText() 済み。
// base（{label,total,max,axisScores}）があれば「1回目 → 今回」の差を出す。
export default function ResultPanel({ skill, result, base, onRewrite, onGuide }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const notes = [
    ["progress", "前回から", result.progress],
    ["good", "良かった点", result.good],
    ["improve", "次に直す", result.improve],
    ["rewrite", skill.rewriteLabel, result.rewrite],
  ];
  const diff = base ? result.total - base.total : 0;
  const links = onGuide ? weakLessons(skill, result.axisScores) : [];

  return (
    <div className="result">
      <div className="r-head">
        <span>採点結果 ／ Inspection</span>
        <span>合計 <b>{result.total}</b>/{result.max}</span>
      </div>
      {base && (
        <div className="cmp">
          {base.label} {base.total}/{base.max} → 今回 <b>{result.total}</b>/{result.max}
          <span className={diff > 0 ? "up" : diff < 0 ? "down" : ""}>
            {diff > 0 ? `＋${diff}` : diff < 0 ? `−${-diff}` : "±0"}
          </span>
        </div>
      )}
      <div className={"gauges" + (base ? " cmpmode" : "")}>
        {skill.axes.map((a) => {
          const val = result.axisScores[a.key] ?? 0;
          const d = base && base.axisScores[a.key] != null ? val - base.axisScores[a.key] : 0;
          return (
            <div className="gauge" key={a.key}>
              <span className="gl">{a.label}</span>
              <div className="gbar">
                <div className="gfill" style={{ width: (mounted ? (val / 5) * 100 : 0) + "%" }} />
              </div>
              <span className="gv">
                {val}/5
                {d !== 0 && <small className={d > 0 ? "up" : "down"}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</small>}
              </span>
            </div>
          );
        })}
      </div>
      {links.length > 0 && (
        <div className="glinks">
          <div className="gh">伸ばすなら ／ 教本</div>
          {links.map((l) => (
            <button key={l.idx} onClick={() => onGuide(l.idx)}>
              📖 {l.t}<small>{l.label}</small>
            </button>
          ))}
        </div>
      )}
      <div className="notes">
        {notes.map(([cls, head, body]) =>
          body ? (
            <div className={"note " + cls} key={cls}>
              <div className="nh">{head}</div>
              <p>{body}</p>
            </div>
          ) : null
        )}
      </div>
      {onRewrite && (
        <div className="r-foot">
          <button className="rewritebtn" onClick={onRewrite}>✎ お手本を見ながら書き直す</button>
        </div>
      )}
    </div>
  );
}
