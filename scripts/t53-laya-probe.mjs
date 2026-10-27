/** T53 — probe Unsloth studio_status + raw system_one response shape. */
const url = (process.env.KEV_MCP_URL || '').trim();
const token = (process.env.KEV_MCP_AUTH_TOKEN || '').trim();
if (!url || !token) {
  console.error('Set KEV_MCP_URL and KEV_MCP_AUTH_TOKEN');
  process.exit(1);
}

async function mcp(body, sid) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  if (sid) headers['mcp-session-id'] = sid;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  const next = res.headers.get('mcp-session-id') || sid;
  let payload = null;
  if (text.includes('data:')) {
    const last = [...text.split(/\r?\n/).filter((l) => l.startsWith('data:'))].at(-1)?.slice(5).trim();
    if (last && last !== '[DONE]') {
      try {
        payload = JSON.parse(last);
      } catch {
        /* ignore */
      }
    }
  } else {
    try {
      payload = JSON.parse(text);
    } catch {
      /* ignore */
    }
  }
  return { status: res.status, sid: next, payload, text: text.slice(0, 800) };
}

const init = await mcp({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 't53-laya-probe', version: '0.1.0' },
  },
});
await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
    'mcp-session-id': init.sid,
  },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
}).catch(() => undefined);

const status = await mcp(
  { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'studio_status', arguments: {} } },
  init.sid,
);
const call = await mcp(
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'system_one',
      arguments: {
        state: { symptom: 'css_orphan', open_question: 'escalate or continue?' },
        questions: {
          action: {
            type: 'choice',
            instructions: 'Mission triage: intervene vs continue',
            criteria: {
              continue: 'Keep executing; no operator needed yet',
              escalate: 'Ask the operator / open intervention',
              skip: 'Skip the blocked work and move on',
            },
          },
        },
      },
    },
  },
  init.sid,
);

console.log(
  JSON.stringify(
    {
      studio_status: status.payload?.result ?? status.text,
      system_one: call.payload ?? call.text,
    },
    null,
    2,
  ),
);
