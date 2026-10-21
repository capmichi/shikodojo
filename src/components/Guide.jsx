import { useState, useEffect, useRef } from "react";
import { SKILLS } from "../lib/skills.js";
import { GUIDES } from "../lib/guides.js";

// 教本：スキル別セクション＋アコーディオン。
// target（{id, lesson?, at}）が来たら該当レッスン（未指定なら最初）を開いてスクロール。
export default function Guide({ target }) {
  const [open, setOpen] = useState({}); // key: `${skillId}:${lessonIdx}` -> bool
  const secRefs = useRef({});
  const lessonRefs = useRef({});

  useEffect(() => {
    if (!target || !target.id) return;
    const li = target.lesson || 0;
    const key = `${target.id}:${li}`;
    setOpen((prev) => ({ ...prev, [key]: true }));
    const el = target.lesson != null ? lessonRefs.current[key] : secRefs.current[target.id];
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [target]);

  function toggle(key) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="view">
      <p className="book-intro">
        考える力は、知識じゃなく型と反復で身につく。ここはその型をまとめた教本。読んだらホームで回す。設計図を読んだら、実際に手を動かす——その繰り返しが一番効く。
      </p>
      <div>
        {SKILLS.map((s, si) => {
          const lessons = GUIDES[s.id] || [];
          if (!lessons.length) return null;
          return (
            <div className="guide-sec" key={s.id} ref={(el) => (secRefs.current[s.id] = el)}>
              <div className="guide-h">
                <span className="gc">{String(si + 1).padStart(2, "0")} ／ {s.cat}</span>
                <span className="gn">{s.name}</span>
                <span className="gt">{s.tagline}</span>
              </div>
              {lessons.map((l, li) => {
                const key = `${s.id}:${li}`;
                const isOpen = !!open[key];
                return (
                  <div className={"lesson" + (isOpen ? " open" : "")} key={key} ref={(el) => (lessonRefs.current[key] = el)}>
                    <div className="lesson-head" onClick={() => toggle(key)}>
                      <span className="lesson-no">▸</span>
                      <span className="lesson-ttl">{l.t}</span>
                      <span className="lesson-arrow">▶</span>
                    </div>
                    <div className="lesson-body">
                      <div className="lesson-inner" dangerouslySetInnerHTML={{ __html: l.html }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
