# 思考道場（shikodojo）

ビジネススキルを毎日ひとつ鍛える個人アプリ。Vite + React の PWA、採点は Vercel Functions 経由の Claude API。

## ローカル開発
```bash
npm install
npm run dev          # UIだけ確認（採点APIは動かない）
# 採点まで動かすなら Vercel CLI:
#   npm i -g vercel
#   vercel dev        # api/claude.js も一緒に動く。要 ANTHROPIC_API_KEY
```

## デプロイ（GitHub → Vercel）
1. GitHub にリポジトリ作成（例 `capmichi/shikodojo`）して push
2. Vercel で Import。Framework は Vite（自動検出）
3. 環境変数 `ANTHROPIC_API_KEY` を Vercel ダッシュボードで設定
4. `api/claude.js` の `ALLOWED_ORIGINS` を本番ドメインに合わせて修正（初期は `https://shikodojo.vercel.app`）
5. デプロイ後、スマホで開いて「ホーム画面に追加」= PWA インストール

## 構成
- `api/claude.js` … Claude プロキシ（model 固定・Origin/レート制限・キーはサーバー側）
- `src/lib/` … データ（skills/guides/groups）とロジック（api/storage/util）
- `src/components/` … 画面（Tabs/Home/DrillForm/ResultPanel/Quiz/Analysis/History/Guide）
- `public/` … manifest・sw.js・アイコン

詳細な設計ルールは `CLAUDE.md` を参照。
