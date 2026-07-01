import { useEffect, useState } from "react";

// 採点結果：ゲージ（軸別）＋良かった点/次に直す/お手本。
// good/improve/rewrite は DrillForm 側で toText() 済み。
export default function ResultPanel({ skill, result }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const notes = [
    ["good", "良かった点", result.good],
    ["improve", "次に直す", result.improve],
    ["rewrite", skill.rewriteLabel, result.rewrite],
  ];

  return (
    <div className="result">
      <div className="r-head">
        <span>採点結果 ／ Inspection</span>
        <span>合計 <b>{result.total}</b>/{result.max}</span>
      </div>
      <div className="gauges">
        {skill.axes.map((a) => {
          const val = result.axisScores[a.key] ?? 0;
          return (
            <div className="gauge" key={a.key}>
              <span className="gl">{a.label}</span>
              <div className="gbar">
                <div className="gfill" style={{ width: (mounted ? (val / 5) * 100 : 0) + "%" }} />
              </div>
              <span className="gv">{val}/5</span>
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
    </div>
  );
}
