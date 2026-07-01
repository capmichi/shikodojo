// Claude API プロキシ（セキュリティ強化版・podcast-app-stack 準拠）
// - model はサーバー側で固定（クライアント指定は無視）
// - max_tokens 上限、Origin チェック、簡易レート制限付き
// - キーは Vercel 環境変数 ANTHROPIC_API_KEY のみ。クライアントには出さない

const MODEL = 'claude-haiku-4-5-20251001'; // ここで固定。クライアントは変更不可
const MAX_TOKENS_CAP = 2000;
const ALLOWED_ORIGINS = [
  'https://shikodojo.vercel.app', // ← 本番ドメインが決まったら差し替える
  'http://localhost:5173',
];

const rateLimits = new Map();
const DAILY_LIMIT = 60; // 採点＋総括で使うので少し多め

function checkRate(ip) {
  const now = Date.now();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const resetAt = midnight.getTime();
  let entry = rateLimits.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt };
    rateLimits.set(ip, entry);
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

function checkOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || '';
  return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkOrigin(req)) return res.status(403).json({ error: 'Forbidden' });

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress || 'unknown';

  if (!checkRate(ip)) {
    return res.status(429).json({
      error: '1日のリクエスト上限に達しました。明日また試してください。',
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' });

  const { body } = req.body || {};
  if (!body || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: 'Missing body' });
  }

  // サーバー側で許可された項目だけを組み立てる（body の素通し禁止）
  const safeBody = {
    model: MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP),
    messages: body.messages,
  };
  if (body.system) safeBody.system = body.system;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safeBody),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
