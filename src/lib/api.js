/* Claude プロキシのクライアント側ラッパー（podcast-app-stack の実績パターン）
   - 529/503/500 は 10→20→30 秒で自動リトライ
   - 429 はリトライしない（上限到達）
   - model はサーバー固定なので送らない */

let _onRetryStatus = null;
// 採点中バナー等にリトライ状況を出したいときに登録する
export function setRetryStatusHandler(fn) { _onRetryStatus = fn; }

async function claudeProxy(body, _retry = 0) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if ((res.status === 529 || res.status === 503 || res.status === 500) && _retry < 3) {
    const wait = (_retry + 1) * 10;
    for (let i = wait; i > 0; i--) {
      if (_onRetryStatus) _onRetryStatus(`混雑中 — ${i}秒後に自動リトライ (${_retry + 1}/3)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (_onRetryStatus) _onRetryStatus(null);
    return claudeProxy(body, _retry + 1);
  }
  if (!res.ok) throw new Error(data.error?.message || data.error || `API error ${res.status}`);
  return data;
}

export async function callClaude(prompt, maxTokens = 1000) {
  const data = await claudeProxy({
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  // content ブロックのテキストを結合
  const blocks = data.content || [];
  return blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
}
