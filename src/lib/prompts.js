/* Claude に渡すプロンプト（スキルのデータから組み立てる） */

export function fieldsText(skill, answers) {
  return skill.fields.map((f) => `${f.label}：${(answers[f.id] || "").trim() || "(未記入)"}`).join("\n");
}

// 点数の目安（全スキル・全軸共通）。日やスキルが違っても同じ物差しで付けさせ、採点のブレを減らす
const SCALE = `採点の目安（全軸共通）：
0＝書かれていない／的外れ
1＝形だけで中身がない
2＝一部できているが、大事な所が抜けている
3＝基本はできている（合格ライン）
4＝具体的で抜けが少なく、現場で通じる
5＝そのまま現場で使えるお手本レベル（めったに付けない）
未記入の欄が担う軸は0〜1点にする。`;

// 状況の出どころごとの見出し
const FACTS_HEAD = {
  case: "状況（例題として与えた事実）",
  real: "状況（回答者が書いた、自分の現場の実際の状況）",
};

// 採点プロンプト。
// facts（例題・実戦の状況）があれば前提として渡し、
// prev（前回の回答と指摘）があれば、直せたかも一言で返させる。
export function gradePrompt(skill, { topic, facts, factsFrom }, answers, prev) {
  const factsText = facts
    ? `
【${FACTS_HEAD[factsFrom] || FACTS_HEAD.case}】
${facts}
回答者はこの状況を前提に書いています。状況にある事実・数字を活かせているか、状況と食い違うことを書いていないかも見てください。
`
    : "";
  const axesText = skill.axes.map((a) => `- ${a.key}: ${a.desc}`).join("\n");
  const jsonKeys = skill.axes.map((a) => `"${a.key}":0`).join(",");
  const prevText = prev
    ? `

【参考：前回の回答と指摘】
このお題は前にも書いています。点数は今回の回答だけを見て、前回に引きずられず採点してください。
前回の回答：
${fieldsText(skill, prev.answers)}
前回の「次に直す」：${prev.improve}`
    : "";
  const progressKey = prev ? `,"progress":"前回の指摘を直せたかを一言"` : "";
  return `${skill.role}
以下の回答を、各軸0〜5点で厳しめに採点し、短いコメントを返してください。

【${skill.poolLabel}】${topic}
${factsText}
${fieldsText(skill, answers)}

採点軸：
${axesText}

${SCALE}${prevText}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"scores":{${jsonKeys}},"good":"良かった点を一言","improve":"次に直す点を具体的に一言","rewrite":"${skill.rewriteInstruction}"${progressKey}}`;
}

// 新しいお題の生成。mode:"case" は状況つき例題、"self" は既存のお題と同じ形式の1題。
// avoid は重ならせたくない既存のお題（データ＋最近やったもの）。
export function genPrompt(skill, mode, avoid) {
  const avoidText = avoid.map((t) => `- ${t}`).join("\n");
  if (mode === "case") {
    const ex = skill.cases[0];
    return `${skill.role}
「${skill.name}」（${skill.tagline}）の練習用に、新しい例題を1つ作ってください。
製造業の現場（溶接・組立・検査など）で実際にありそうな場面にし、登場人物・数字・期限・この後の予定・制約を具体的に入れること。
回答者が考えるべき「判断」や「言い方」の答えは書かず、状況の事実だけを書くこと。
状況は4〜6行、1行60字以内。

すでにある例題（これらと重ならない場面にする）：
${avoidText}

書き方の見本：
お題：${ex.t}
状況：
${ex.s}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"t":"お題（40字以内）","s":["状況1行目","状況2行目"]}`;
  }
  return `${skill.role}
「${skill.name}」（${skill.tagline}）の練習用に、新しいお題を1つ作ってください（「${skill.poolLabel}」として出すもの）。
下の既存のものと同じ形式・同じくらいの長さにし、内容は重ならないようにすること。

既存：
${avoidText}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"t":"新しい${skill.poolLabel}"}`;
}
