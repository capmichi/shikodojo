/* Claude に渡すプロンプト（スキルのデータから組み立てる） */

export function fieldsText(skill, answers) {
  return skill.fields.map((f) => `${f.label}：${(answers[f.id] || "").trim() || "(未記入)"}`).join("\n");
}

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
${axesText}${prevText}

必ず以下のJSONのみ返す（前置き・マークダウン・コードブロック禁止）：
{"scores":{${jsonKeys}},"good":"良かった点を一言","improve":"次に直す点を具体的に一言","rewrite":"${skill.rewriteInstruction}"${progressKey}}`;
}
