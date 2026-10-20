import { useEffect, useState } from "react";

// 採点結果：ゲージ（軸別）＋良かった点/次に直す/お手本。
// good/improve/rewrite/progress は DrillForm 側で toText() 済み。
// base（{label,total,max,axisScores}）があれば「1回目 → 今回」の差を出す。
export default function ResultPanel({ skill, result, base, onRewrite }) {
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
