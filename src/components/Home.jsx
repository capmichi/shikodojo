import { useState, useMemo } from "react";
import { WRITE_SKILLS } from "../lib/skills.js";
import { skillAvg } from "../lib/util.js";
import { todayStr } from "../lib/storage.js";
import { pickToday } from "../lib/pick.js";
import DrillForm from "./DrillForm.jsx";

// 今日のスキルを選んだ理由（一言）
function reason({ avg, days }) {
  if (avg === null) return "まだ挑戦していないスキル";
  const when = days === 1 ? "前回は昨日" : `${days}日ぶり`;
  return `平均 ${avg}% ／ ${when}`;
}

// ホーム：今日のスキル（苦手×間隔で選ぶ）＋スキル一覧（書く系のみ）＋練習
export default function Home({ history, addRecord, updateRecord, gotoGuide }) {
  const [selected, setSelected] = useState(null); // 選択中スキル（nullで一覧表示）

  const today = todayStr();
  const pick = useMemo(() => pickToday(WRITE_SKILLS, history, today), [history, today]);
  const doneToday = new Set(history.filter((r) => r.date === today).map((r) => r.skillId));
  const pickDone = doneToday.has(pick.skill.id);

  if (selected) {
    return (
      <div className="view">
        <div id="drillSection">
          <div className="drillbar">
            <button className="back" onClick={() => setSelected(null)}>← スキル一覧へ</button>
            <button className="guidebtn" onClick={() => gotoGuide(selected.id)}>📖 このスキルの教本</button>
          </div>
          <DrillForm skill={selected} history={history} addRecord={addRecord} updateRecord={updateRecord} gotoGuide={gotoGuide} />
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className={"hero" + (pickDone ? " done" : "")}>
        <div className="hero-in">
          <div className="ey">
            今日のスキル ／ Today
            {pickDone && <span className="donebadge">今日は済み ✓</span>}
          </div>
          <div className="nm">{pick.skill.name}</div>
          <div className="tg">{pick.skill.tagline}</div>
          <div className="why">{reason(pick)}</div>
          <button onClick={() => setSelected(pick.skill)}>{pickDone ? "もう一題やる →" : "これをやる →"}</button>
        </div>
      </div>

      <div className="gridlabel">ほかのスキルを選ぶ ／ All skills</div>
      <div className="grid">
        {WRITE_SKILLS.map((s) => {
          const av = skillAvg(history, s.id);
          return (
            <button key={s.id} className="scard" onClick={() => setSelected(s)}>
              <div className="c">{s.cat}{doneToday.has(s.id) && <span className="today">今日 ✓</span>}</div>
              <div className="n">{s.name}</div>
              <div className="t">{s.tagline}</div>
              <div className="av">{av !== null ? `平均 ${av}%` : "未挑戦"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
