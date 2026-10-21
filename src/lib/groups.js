/* 各スキルの採点軸を、3つの大グループに対応づける（スキル横断の弱点分析用）
   depth=深さ・論理 ／ concrete=具体・数字 ／ delivery=伝え方・相手視点
   ※中身は叩き台HTMLと同一 */
export const GROUPS = { depth:"深さ・論理", concrete:"具体・数字", delivery:"伝え方・相手視点" };

export const AXIS_GROUP = {
  depth:"depth", abstract:"depth", foresee:"depth", cause:"depth", sharp:"depth", essence:"depth",
  numbers:"concrete", done:"concrete", clarity:"concrete", fact:"concrete", prepare:"concrete", noloss:"concrete",
  prep:"delivery", coverage:"delivery", first:"delivery", action:"delivery", predict:"delivery",
  angle:"delivery", understand:"delivery", assert:"delivery", tone:"delivery", alt:"delivery", concise:"delivery",
  // 真因を掘る・優先順位をつける・改善提案を書く・フィードバックする
  chain:"depth", system:"depth", criteria:"depth", sequence:"depth", feasible:"depth", impact:"depth",
  factbase:"concrete", prevent:"concrete", confirm:"concrete", baseline:"concrete", effect:"concrete",
  observe:"concrete", nextstep:"concrete",
  drop:"delivery", decider:"delivery", listen:"delivery",
};

// クイズの分野（questions[].cat）→ グループ。クイズの正答率も弱点の傾向に入れる
export const QUIZ_CAT_GROUP = {
  "具体と抽象":"depth", "思考の深さ":"depth", "論点":"depth", "論理の飛躍":"depth", "MECE":"depth",
  "仮説思考":"depth", "反証":"depth",
  "数字で語る":"concrete", "抽象の罠":"concrete", "報告":"concrete",
  "結論ファースト":"delivery", "PREP":"delivery", "指示":"delivery",
  "なぜなぜ":"depth", "優先順位":"depth", "改善提案":"concrete", "フィードバック":"concrete",
};

// 1件の記録の、グループごとの値（0〜1）。書く系は軸の平均、クイズは groupRates（分野別の正答率）
export function recordGroups(r) {
  if (r.groupRates) return r.groupRates;
  if (!r.axisScores) return null;
  const acc = {};
  for (const k in r.axisScores) {
    const g = AXIS_GROUP[k];
    if (g) (acc[g] = acc[g] || []).push(r.axisScores[k] / 5);
  }
  const out = {};
  for (const g in acc) out[g] = acc[g].reduce((a, b) => a + b, 0) / acc[g].length;
  return out;
}
