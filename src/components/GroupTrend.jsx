import { useState, useRef } from "react";
import { GROUPS, recordGroups } from "../lib/groups.js";

// 3つの力の推移（折れ線）。各点は「その回までの直近5回の平均」、直近12回ぶん。
// 色はグループに固定（並び順で塗り替えない）：深さ=系列1、具体=系列2、伝え方=系列3。
const KEYS = ["depth", "concrete", "delivery"];
const COLOR = { depth: "var(--series-1)", concrete: "var(--series-2)", delivery: "var(--series-3)" };
const WINDOW = 5;
const COUNT = 12;

// 描画領域（viewBox 単位）
const W = 320, H = 150, L = 26, R = 10, T = 10, B = 22;

function buildPoints(history) {
  const recs = history.map((r) => ({ date: r.date, g: recordGroups(r) })).filter((r) => r.g);
  const points = [];
  for (let i = Math.max(0, recs.length - COUNT); i < recs.length; i++) {
    const win = recs.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const v = {};
    KEYS.forEach((k) => {
      const vals = win.map((x) => x.g[k]).filter((x) => x != null);
      v[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) : null;
    });
    points.push({ date: recs[i].date, v });
  }
  return points;
}

const md = (d) => d.slice(5).replace("-", "/");

export default function GroupTrend({ history }) {
  const points = buildPoints(history);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  if (points.length < 3) return null;

  const n = points.length;
  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + ((100 - v) / 100) * (H - T - B);

  // 欠けた点（その時点で一度も出ていない力）は線を切る
  function path(k) {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = p.v[k];
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  function lastIdx(k) {
    for (let i = n - 1; i >= 0; i--) if (points[i].v[k] != null) return i;
    return -1;
  }

  function onMove(e) {
    const box = svgRef.current.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((vx - L) / (W - L - R)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  function onKey(e) {
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
    else if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  }

  const latest = points[n - 1].v;
  const hp = hover != null ? points[hover] : null;
  // ツールチップはクロスヘアの横に出す（左半分なら右側、右半分なら左側）。点を隠さない
  const tipX = hover != null ? (x(hover) / W) * 100 : 0;
  const tipStyle = tipX < 50 ? { left: `calc(${tipX}% + 10px)` } : { right: `calc(${100 - tipX}% + 10px)` };

  return (
    <div className="trend3">
      <div className="t3legend">
        {KEYS.map((k) => (
          <span key={k}>
            <i style={{ background: COLOR[k] }} />
            {GROUPS[k]} <b>{latest[k] != null ? `${latest[k]}%` : "—"}</b>
          </span>
        ))}
      </div>
      <div className="t3plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="3つの力の推移（直近5回の平均）"
          tabIndex={0}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="t3grid" />
              <text x={L - 6} y={y(v) + 3} className="t3tick" textAnchor="end">{v}</text>
            </g>
          ))}
          <text x={L} y={H - 6} className="t3tick">{md(points[0].date)}</text>
          <text x={W - R} y={H - 6} className="t3tick" textAnchor="end">最新 {md(points[n - 1].date)}</text>
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="t3cross" />}
          {KEYS.map((k) => (
            <path key={k} d={path(k)} fill="none" stroke={COLOR[k]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {KEYS.map((k) => {
            const i = hover != null ? hover : lastIdx(k);
            const v = i >= 0 ? points[i].v[k] : null;
            return v == null ? null : <circle key={k} cx={x(i)} cy={y(v)} r="4" fill={COLOR[k]} className="t3dot" />;
          })}
        </svg>
        {hp && (
          <div className="t3tip" style={tipStyle}>
            <div className="t3date">{hp.date}</div>
            {KEYS.map((k) => (
              <div key={k} className="t3row">
                <i style={{ background: COLOR[k] }} />
                <b>{hp.v[k] != null ? `${hp.v[k]}%` : "—"}</b>
                <span>{GROUPS[k]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="t3table">
        <summary>表で見る</summary>
        <table>
          <thead>
            <tr><th>日付</th>{KEYS.map((k) => <th key={k}>{GROUPS[k]}</th>)}</tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{md(p.date)}</td>
                {KEYS.map((k) => <td key={k}>{p.v[k] != null ? `${p.v[k]}%` : "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
