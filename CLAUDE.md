# CLAUDE.md — 思考道場（shikodojo）

ビジネススキル（思考・伝達・指示など）を毎日ひとつ鍛える個人アプリ。
お題を出す → 型に沿って書く → Claude が採点 → 弱点が見える、のループ。

## スタック
- Vite + React (PWA)、Vercel Functions（`api/claude.js`）、Claude API（Haiku、プロキシ経由）
- 保存：IndexedDB（DB名 `shikodojo` / ストア `history`）
- TTSなし（このアプリには不要）
- デプロイ：GitHub `capmichi/shikodojo` → Vercel 自動

## 設計の核：データ駆動
- `src/lib/skills.js` … `SKILLS`（書く系6＋クイズ）。スキルはここに足すだけで増える
  - `pool` … 「自分で考える」お題（文字列。状況は自分の現場で補う）
  - `cases` … 「例題」お題（`C(お題, 状況1行, 状況2行, …)`。事実・数字は用意済み、判断と言葉だけ自分で）。任意。あるスキルだけ練習画面に切替が出る
  - 「一言にする」は本文自体が題材なので `cases` なし
- `src/lib/guides.js` … `GUIDES`（教本：skill.id ごと）
- `src/lib/groups.js` … `GROUPS` / `AXIS_GROUP`（分析の3グループと軸の割り当て）
- 採点プロンプトはスキルの `role/fields/axes/rewriteInstruction` から動的生成（`src/components/DrillForm.jsx`）
- **スキル追加 = SKILLS に1ブロック + GUIDES に同id + AXIS_GROUP に軸割り当て。UIは触らない**

## タブ
ホーム（書く系のみ・今日の1つ＋一覧）／クイズ（独立）／分析／履歴／教本

## 環境変数（Vercel）
- `ANTHROPIC_API_KEY` … Claude APIキー（サーバー側のみ）

## IndexedDB キー / レコード
- ストア `history`：`{id?, date, skillId, skillName, score, max, axisScores?, topic?, mode?, answers?, feedback?, redo?}` の配列（キー `all`）
- `axisScores` は書く系のみ。分析の「弱点の傾向」の元データ
- クイズ記録は `axisScores` なし（グループ集計から自動除外）
- 書く系（v1.1〜）：`id`（Date.now）・`topic`・`mode`（`case`/`self`）・`answers`（field id→文章）・`feedback`（good/improve/rewrite/progress）
- `redo` … 書き直しの最新 `{score, axisScores, n, answers, feedback}`。1回目の記録に `updateRecord` で添える
- **分析・平均は `score`（1回目）だけを見る。** redo は表示用（書き直しで平均を水増ししない）
- v1.0 の古い記録は `id/answers` なし → 履歴で開けない・前回比較に出ないだけで、そのまま動く

## 落とし穴・約束ごと
- **APIキーをクライアントに出さない。** `/api/claude` 経由のみ、model はサーバー固定
- **採点結果の表示前に `toText()` で正規化**（AIが rewrite をオブジェクトで返す `[object Object]` バグ対策。`src/lib/util.js`）
- 採点の返答は `parseJSON()` で読む（前置き・コードブロック付きでも最初の `{`〜最後の `}` を読む）
- 日替わりのお題は `topicIndex()`。dayIndex の剰余にするとスキルのローテと噛み合って出ないお題ができる
- クイズの選択肢は出題ごとにシャッフル（データの正解 `a` はほぼ先頭なので、並べ替えないと「全部A」になる）
- 再採点・同じお題の再挑戦では、プロンプトに前回の回答と「次に直す」を渡し `progress` を返させる
- streak は「今日未実施でも昨日まで連続なら継続」（`src/lib/storage.js` computeStreak）
- 分析の注意書き（「傾向のヒントとして／これが全てではありません」）を消さない
- `APP_VERSION`（`public/sw.js`）＋ sw.js の `Cache-Control: no-cache`（`vercel.json`）をセットで維持
- UI・コメントは日本語

## 作業後に更新すること
新しい環境変数・IndexedDBキー・スキル・自動処理を足したら、このファイルに追記する。
