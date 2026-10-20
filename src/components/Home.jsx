import { useState } from "react";
import { WRITE_SKILLS } from "../lib/skills.js";
import { dayIndex, skillAvg } from "../lib/util.js";
import DrillForm from "./DrillForm.jsx";

// ホーム：今日のスキル（書く系を日替わりローテ）＋スキル一覧（書く系のみ）＋練習
export default function Home({ history, addRecord, updateRecord, gotoGuide }) {
  const [selected, setSelected] = useState(null); // 選択中スキル（nullで一覧表示）

  const n = WRITE_SKILLS.length;
  const today = WRITE_SKILLS[((dayIndex() % n) + n) % n];

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
      <div className="hero">
        <div className="hero-in">
          <div className="ey">今日のスキル ／ Today</div>
          <div className="nm">{today.name}</div>
          <div className="tg">{today.tagline}</div>
          <button onClick={() => setSelected(today)}>これをやる →</button>
        </div>
      </div>

      <div className="gridlabel">ほかのスキルを選ぶ ／ All skills</div>
      <div className="grid">
        {WRITE_SKILLS.map((s) => {
          const av = skillAvg(history, s.id);
          return (
            <button key={s.id} className="scard" onClick={() => setSelected(s)}>
              <div className="c">{s.cat}</div>
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
