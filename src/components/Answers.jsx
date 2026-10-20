// 保存した回答と指摘の表示（練習画面の「前回を見る」と履歴の詳細で共用）
// rec は記録そのもの、または記録の redo（どちらも answers/feedback を持つ）
export default function Answers({ skill, rec }) {
  const fb = rec.feedback || {};
  return (
    <div className="answers">
      {skill.fields.map((f) =>
        (rec.answers[f.id] || "").trim() ? (
          <div className="ar" key={f.id}>
            <b>{f.label}</b>
            <p>{rec.answers[f.id]}</p>
          </div>
        ) : null
      )}
      {fb.improve && <div className="ar improve"><b>次に直す</b><p>{fb.improve}</p></div>}
      {fb.rewrite && <div className="ar rewrite"><b>{skill.rewriteLabel}</b><p>{fb.rewrite}</p></div>}
    </div>
  );
}
