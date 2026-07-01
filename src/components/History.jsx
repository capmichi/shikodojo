import { SKILLS } from "../lib/skills.js";
import { skillAvg } from "../lib/util.js";

// 履歴：連続日数・総回数・伸びしろ・最近15件・全消去
export default function History({ history, streak, clear }) {
  // 伸びしろ（平均％が最低、2回以上やったもの）
  let weak = null;
  const stats = SKILLS
    .map((s) => ({ s, avg: skillAvg(history, s.id), n: history.filter((r) => r.skillId === s.id).length }))
    .filter((x) => x.avg !== null && x.n >= 2);
  if (stats.length) {
    stats.sort((a, b) => a.avg - b.avg);
    weak = stats[0];
  }

  const recent = [...history].reverse().slice(0, 15);

  function onClear() {
    if (window.confirm("すべての記録を消します。よろしいですか?")) clear();
  }

  return (
    <div className="view">
      <div className="hsumm">
        <div className="hbox"><div className="hl">連続日数</div><div className="hv">{streak}<small> 日</small></div></div>
        <div className="hbox"><div className="hl">総練習回数</div><div className="hv">{history.length}<small> 回</small></div></div>
      </div>

      {weak && (
        <div className="weak">
          <b>伸びしろ：{weak.s.name}</b>（平均 {weak.avg}%）— 教本の関連レッスンを読み直してから、もう一度挑戦すると効きます。
        </div>
      )}

      <div className="gridlabel">最近の記録 ／ Recent</div>
      {history.length === 0 ? (
        <div className="hempty">まだ記録がありません。ホームから1つやってみましょう。</div>
      ) : (
        <div>
          {recent.map((r, i) => (
            <div className="hrow" key={i}>
              <span><span className="hd">{r.date}</span>　{r.skillName}</span>
              <span className="hs">{r.score}/{r.max}</span>
            </div>
          ))}
        </div>
      )}

      <button className="clearbtn" onClick={onClear}>記録をすべて消す</button>
    </div>
  );
}
