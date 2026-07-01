/* 各スキルの採点軸を、3つの大グループに対応づける（スキル横断の弱点分析用）
   depth=深さ・論理 ／ concrete=具体・数字 ／ delivery=伝え方・相手視点
   ※中身は叩き台HTMLと同一 */
export const GROUPS = { depth:"深さ・論理", concrete:"具体・数字", delivery:"伝え方・相手視点" };

export const AXIS_GROUP = {
  depth:"depth", abstract:"depth", foresee:"depth", cause:"depth", sharp:"depth", essence:"depth",
  numbers:"concrete", done:"concrete", clarity:"concrete", fact:"concrete", prepare:"concrete", noloss:"concrete",
  prep:"delivery", coverage:"delivery", first:"delivery", action:"delivery", predict:"delivery",
  angle:"delivery", understand:"delivery", assert:"delivery", tone:"delivery", alt:"delivery", concise:"delivery",
};
