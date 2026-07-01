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
- `src/lib/guides.js` … `GUIDES`（教本：skill.id ごと）
- `src/lib/groups.js` … `GROUPS` / `AXIS_GROUP`（分析の3グループと軸の割り当て）
- 採点プロンプトはスキルの `role/fields/axes/rewriteInstruction` から動的生成（`src/components/DrillForm.jsx`）
- **スキル追加 = SKILLS に1ブロック + GUIDES に同id + AXIS_GROUP に軸割り当て。UIは触らない**

## タブ
ホーム（書く系のみ・今日の1つ＋一覧）／クイズ（独立）／分析／履歴／教本

## 環境変数（Vercel）
- `ANTHROPIC_API_KEY` … Claude APIキー（サーバー側のみ）

## IndexedDB キー / レコード
- ストア `history`：`{date, skillId, skillName, score, max, axisScores?}` の配列（キー `all`）
- `axisScores` は書く系のみ。分析の「弱点の傾向」の元データ
- クイズ記録は `axisScores` なし（グループ集計から自動除外）

## 落とし穴・約束ごと
- **APIキーをクライアントに出さない。** `/api/claude` 経由のみ、model はサーバー固定
- **採点結果の表示前に `toText()` で正規化**（AIが rewrite をオブジェクトで返す `[object Object]` バグ対策。`src/lib/util.js`）
- streak は「今日未実施でも昨日まで連続なら継続」（`src/lib/storage.js` computeStreak）
- 分析の注意書き（「傾向のヒントとして／これが全てではありません」）を消さない
- `APP_VERSION`（`public/sw.js`）＋ sw.js の `Cache-Control: no-cache`（`vercel.json`）をセットで維持
- UI・コメントは日本語

## 作業後に更新すること
新しい環境変数・IndexedDBキー・スキル・自動処理を足したら、このファイルに追記する。
