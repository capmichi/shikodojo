import { useState, useRef } from "react";
import { SKILLS } from "../lib/skills.js";
import { skillAvg } from "../lib/util.js";
import { todayStr, isRecord } from "../lib/storage.js";
import Answers from "./Answers.jsx";

const PERSIST_TEXT = {
  true: "有効（ブラウザが記録を勝手に消さない設定）",
  false: "未許可（ホーム画面に追加して使うと許可されやすい）",
  null: "このブラウザは非対応",
};

// 履歴：連続日数・総回数・伸びしろ・最近15件（タップで書いた文章を読み返す）・バックアップ・全消去
export default function History({ history, streak, clear, importRecords, persisted }) {
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

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

  // 全記録をJSONファイルにして保存（機種変更・ブラウザのデータ削除への備え）
  function onExport() {
    const data = { app: "shikodojo", format: 1, exportedAt: new Date().toISOString(), history };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shikodojo-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg(`${history.length}件を書き出しました。`);
  }

  async function onImport(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const arr = Array.isArray(data) ? data : data && data.app === "shikodojo" ? data.history : null;
      if (!Array.isArray(arr)) throw new Error("思考道場の書き出しファイルではありません");
      const valid = arr.filter(isRecord);
      if (!valid.length) throw new Error("読み込める記録がありません");
      if (!window.confirm(`${valid.length}件の記録を読み込みます（すでにある記録は足しません）。よろしいですか?`)) return;
      const { added, skipped } = await importRecords(valid);
      const notes = [skipped && `重複${skipped}件`, arr.length > valid.length && `読めない${arr.length - valid.length}件`].filter(Boolean);
      setMsg(`${added}件を追加しました。` + (notes.length ? `（${notes.join("・")}は除外）` : ""));
    } catch (err) {
      setMsg("読み込めませんでした。（" + err.message + "）");
    }
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
          {recent.map((r, i) => {
            const skill = SKILLS.find((s) => s.id === r.skillId);
            const canOpen = !!(r.answers && skill);
            const isOpen = canOpen && openId === r.id;
            return (
              <div key={r.id || i}>
                <div
                  className={"hrow" + (canOpen ? " canopen" : "")}
                  onClick={canOpen ? () => setOpenId(isOpen ? null : r.id) : undefined}
                >
                  <span>
                    <span className="hd">{r.date}</span>　{r.skillName}
                    {canOpen && <span className="harrow">{isOpen ? "▾" : "▸"}</span>}
                  </span>
                  <span className="hs">
                    {r.score}/{r.max}
                    {r.redo && <span className="hredo"> → {r.redo.score}</span>}
                  </span>
                </div>
                {isOpen && (
                  <div className="hdetail">
                    <div className="htopic">{r.topic}</div>
                    {(r.facts || r.mode === "case") && (
                      <div className="hfacts">{r.facts || skill.cases?.find((c) => c.t === r.topic)?.s}</div>
                    )}
                    <div className="hver">
                      1回目（{r.score}/{r.max}）
                      {r.timeUsed != null && `　⏱ ${Math.floor(r.timeUsed / 60)}:${String(r.timeUsed % 60).padStart(2, "0")} ／ 制限${r.timeLimit / 60}分`}
                    </div>
                    <Answers skill={skill} rec={r} />
                    {r.redo && r.redo.answers && (
                      <>
                        <div className="hver">書き直し {r.redo.n}回目（{r.redo.score}/{r.max}）</div>
                        <Answers skill={skill} rec={r.redo} />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="gridlabel" style={{ marginTop: "24px" }}>バックアップ ／ Backup</div>
      <div className="backup">
        <p>記録はこの端末の中だけにあります。機種変更やブラウザのデータ削除に備えて、ときどき書き出しておくと安心です。</p>
        <div className="bk-btns">
          <button onClick={onExport} disabled={!history.length}>記録を書き出す</button>
          <button onClick={() => fileRef.current.click()}>記録を読み込む</button>
          <input type="file" accept=".json,application/json" ref={fileRef} hidden onChange={onImport} />
        </div>
        {msg && <div className="bk-msg">{msg}</div>}
        <div className="bk-persist">保存の保護：{PERSIST_TEXT[persisted]}</div>
      </div>

      <button className="clearbtn" onClick={onClear}>記録をすべて消す</button>
    </div>
  );
}
