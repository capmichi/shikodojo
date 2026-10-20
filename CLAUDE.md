# CLAUDE.md — 思考道場（shikodojo）

ビジネススキル（思考・伝達・指示など）を毎日ひとつ鍛える個人アプリ。
お題を出す → 型に沿って書く → Claude が採点 → 弱点が見える、のループ。

## スタック
- Vite + React (PWA)、Vercel Functions（`api/claude.js`）、Claude API（Haiku、プロキシ経由）
- 保存：IndexedDB（DB名 `shikodojo` / ストア `history`）＋ localStorage（下書き・端末ごとの設定だけ）
- TTSなし（このアプリには不要）
- デプロイ：GitHub `capmichi/shikodojo` → Vercel 自動

## 設計の核：データ駆動
- `src/lib/skills.js` … `SKILLS`（書く系10＋クイズ）。スキルはここに足すだけで増える
  - `pool` … 「自分で考える」お題（文字列。状況は自分の現場で補う）
  - `cases` … 「例題」お題（`C(お題, 状況1行, 状況2行, …)`。事実・数字は用意済み、判断と言葉だけ自分で）。任意。あるスキルだけ練習画面に切替が出る
  - `real` … 「実戦」（`{ph, factsPh?}`。自分の現場の場面を入力。`factsPh` が無ければ状況欄なし）。任意
  - 「一言にする」は本文自体が題材なので `cases` なし（モードは 練習／実戦）
- `src/lib/guides.js` … `GUIDES`（教本：skill.id ごと）。各レッスンの `axes` ＝そのレッスンが鍛える採点軸（低い軸 → レッスンへのリンクに使う）
- `src/lib/groups.js` … `GROUPS` / `AXIS_GROUP`（分析の3グループと軸の割り当て）、`QUIZ_CAT_GROUP`（クイズの分野 → グループ）、`recordGroups()`
- `src/lib/prompts.js` … 採点（`gradePrompt`）と AI お題生成（`genPrompt`）のプロンプト。スキルの `role/fields/axes/rewriteInstruction` から動的生成。点数の目安 `SCALE` は全軸共通
- `src/lib/pick.js` … 今日のスキル（`pickToday`）とお題（`pickTopic`）の選び方
- **スキル追加 = SKILLS に1ブロック（pool/cases/real/fields/axes）+ GUIDES に同id（axes 付き）+ AXIS_GROUP に軸割り当て（＋クイズに1問なら QUIZ_CAT_GROUP）。UIは触らない**

## タブ
ホーム（書く系のみ・今日の1つ＋一覧）／クイズ（独立）／分析／履歴／教本

## 環境変数（Vercel）
- `ANTHROPIC_API_KEY` … Claude APIキー（サーバー側のみ）

## IndexedDB キー / レコード
- ストア `history`：記録の配列（キー `all`）
  `{id?, date, skillId, skillName, score, max, axisScores?, groupRates?, topic?, mode?, facts?, gen?, answers?, feedback?, redo?, timeLimit?, timeUsed?}`
- `axisScores` は書く系のみ。分析の「弱点の傾向」の元データ
- クイズ（v1.2〜）は `groupRates`（グループ別の正答率 0〜1）を持ち、弱点の傾向・力ごとの推移に入る。v1.1 までのクイズ記録は `groupRates` なし → 集計から自動除外
- 書く系（v1.1〜）：`id`（Date.now）・`topic`・`mode`（`case`/`self`/`real`）・`answers`（field id→文章）・`feedback`（good/improve/rewrite/progress）
- `facts` … データに無い状況（実戦で入力したもの・AI作成の例題）。`gen:true` は AI で作ったお題
- `timeLimit` / `timeUsed`（秒）… 制限時間ありで書いたときだけ
- `redo` … 書き直しの最新 `{score, axisScores, n, answers, feedback}`。1回目の記録に `updateRecord` で添える
- **分析・平均は `score`（1回目）だけを見る。** redo は表示用（書き直しで平均を水増ししない）
- v1.0 の古い記録は `id/answers` なし → 履歴で開けない・前回比較に出ないだけで、そのまま動く

## localStorage（端末ごとの便利機能。消えても練習はそのまま動く）
- `shikodojo:drafts` … 採点前の書きかけ `{[skillId]: {mode, topic, facts?, gen?, vals, at}}`（`src/lib/draft.js`）。採点成功・入力が空になった時点で消す
- `shikodojo:pref:timelimit` … 制限時間の選択（秒。0=なし）

## 自動処理
- 起動時に `navigator.storage.persist()` を頼む（`requestPersist`）。結果は履歴タブの「保存の保護」に表示
- 書き出し（`shikodojo-日付.json`：`{app:"shikodojo", format:1, exportedAt, history}`）／読み込みは履歴タブ。読み込みは足すだけで、同じ `id`（無ければ日付・スキル・点数）は重複として除外

## 落とし穴・約束ごと
- **APIキーをクライアントに出さない。** `/api/claude` 経由のみ、model はサーバー固定
- **採点結果の表示前に `toText()` で正規化**（AIが rewrite をオブジェクトで返す `[object Object]` バグ対策。`src/lib/util.js`）
- AI の返答（採点・お題生成）は `parseJSON()` で読む（前置き・コードブロック付きでも最初の `{`〜最後の `}` を読む）
- 今日のスキルは「苦手（平均が低い）× しばらくやっていない」で選ぶ。**今日の記録は計算から外す**（やった後も一日同じスキルのまま）
- お題は `pickTopic()`：まだやっていないお題を先頭から → 全部やったら一番前にやったもの（dayIndex の剰余で決めない）
- クイズの選択肢は出題ごとにシャッフル（データの正解 `a` はほぼ先頭なので、並べ替えないと「全部A」になる）
- 再採点・同じお題の再挑戦では、プロンプトに前回の回答と「次に直す」を渡し `progress` を返させる
- グラフの系列色（`--series-1〜3`）は3つの力に固定。色覚多様性チェック済みなので、変えるときは dataviz の検証を通す
- streak は「今日未実施でも昨日まで連続なら継続」（`src/lib/storage.js` computeStreak）
- 分析の注意書き（「傾向のヒントとして／これが全てではありません」）を消さない
- `APP_VERSION`（`public/sw.js`）＋ sw.js の `Cache-Control: no-cache`（`vercel.json`）をセットで維持
- UI・コメントは日本語

## 作業後に更新すること
新しい環境変数・IndexedDBキー・スキル・自動処理を足したら、このファイルに追記する。
