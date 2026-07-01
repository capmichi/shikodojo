// ホーム / クイズ / 分析 / 履歴 / 教本 の5タブ
const TABS = [
  ["home", "ホーム"],
  ["quiz", "クイズ"],
  ["analysis", "分析"],
  ["hist", "履歴"],
  ["book", "教本"],
];

export default function Tabs({ tab, setTab }) {
  return (
    <div className="tabs">
      {TABS.map(([key, label]) => (
        <button
          key={key}
          className={"tab" + (tab === key ? " on" : "")}
          onClick={() => setTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
