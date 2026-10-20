import { useState, useEffect } from "react";
import { useHistory } from "./hooks/useHistory.js";
import Tabs from "./components/Tabs.jsx";
import Home from "./components/Home.jsx";
import Quiz from "./components/Quiz.jsx";
import Analysis from "./components/Analysis.jsx";
import History from "./components/History.jsx";
import Guide from "./components/Guide.jsx";

// アプリ全体の器：タブ切替と履歴の受け渡しだけ。ロジックは各コンポーネントへ。
export default function App() {
  const [tab, setTab] = useState("home");
  const [guideTarget, setGuideTarget] = useState(null); // 教本へジャンプするスキルid
  const { history, ready, addRecord, updateRecord, clear, streak } = useHistory();

  // React マウント後にスプラッシュを消す
  useEffect(() => {
    if (ready && window.hideSplash) window.hideSplash();
  }, [ready]);

  // 練習画面などから「このスキルの教本」を開く
  function gotoGuide(skillId) {
    setGuideTarget({ id: skillId, at: Date.now() });
    setTab("book");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeTab(next) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <span className="kicker">Business Skill Gym</span>
          <h1>思考道場<span className="dot">.</span><span className="pro">PRO</span></h1>
        </div>
        <div className="streak">
          <div className="n">{streak}</div>
          <div className="l">日連続</div>
        </div>
      </header>

      <Tabs tab={tab} setTab={changeTab} />

      {tab === "home" && (
        <Home history={history} addRecord={addRecord} updateRecord={updateRecord} gotoGuide={gotoGuide} />
      )}
      {tab === "quiz" && (
        <Quiz addRecord={addRecord} gotoGuide={gotoGuide} />
      )}
      {tab === "analysis" && <Analysis history={history} />}
      {tab === "hist" && (
        <History history={history} streak={streak} clear={clear} />
      )}
      {tab === "book" && (
        <Guide target={guideTarget} />
      )}

      <footer>思考道場 v1.1 ／ 製造現場 × 思考トレーニング</footer>
    </div>
  );
}
