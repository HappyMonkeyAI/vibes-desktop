import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Tiny streamable-HTTP Decision MCP for hermetic probe / intervene tests.
 * Not a substitute for live Unsloth/KEV (T62) — only proves desktop wiring.
 */

export type MockDecisionMcpOptions = {
  /** Bearer that is accepted. Default: test-token */
  token?: string;
  /** Tool name to answer. Default: kev_evaluate */
  toolName?: 'kev_evaluate' | 'system_one';
  /** Choice returned in structuredContent. Default: continue */
  choice?: 'continue' | 'escalate' | 'skip';
};

export type MockDecisionMcp = {
  url: string;
  token: string;
  close: () => Promise<void>;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...extraHeaders,
  });
  res.end(payload);
}

export async function startMockDecisionMcp(
  options: MockDecisionMcpOptions = {},
): Promise<MockDecisionMcp> {
  const token = options.token ?? 'test-token';
  const toolName = options.toolName ?? 'kev_evaluate';
  const choice = options.choice ?? 'continue';
  const sessionId = 'mock-sess-1';

  const server: Server = createServer(async (req, res) => {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401).end();
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(406, { 'Content-Type': 'text/plain' }).end('session required');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }

    let parsed: { method?: string; id?: number; params?: { name?: string } } = {};
    try {
      parsed = JSON.parse(await readBody(req)) as typeof parsed;
    } catch {
      res.writeHead(400).end();
      return;
    }

    if (parsed.method === 'initialize') {
      sendJson(
        res,
        200,
        { jsonrpc: '2.0', id: parsed.id ?? 1, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'mock-decision' } } },
        { 'mcp-session-id': sessionId },
      );
      return;
    }

    if (parsed.method === 'notifications/initialized') {
      res.writeHead(202, { 'mcp-session-id': sessionId }).end();
      return;
    }

    if (parsed.method === 'tools/call') {
      const name = parsed.params?.name;
      if (name !== toolName && name !== 'kev_evaluate' && name !== 'system_one') {
        sendJson(res, 200, {
          jsonrpc: '2.0',
          id: parsed.id ?? 2,
          result: { isError: true, content: [{ type: 'text', text: `unknown tool ${name}` }] },
        }, { 'mcp-session-id': sessionId });
        return;
      }
      sendJson(
        res,
        200,
        {
          jsonrpc: '2.0',
          id: parsed.id ?? 2,
          result: {
            structuredContent: {
              model: 'mock-decision',
              answers: {
                action: {
                  choice,
                  probabilities: {
                    continue: choice === 'continue' ? 0.8 : 0.1,
                    escalate: choice === 'escalate' ? 0.8 : 0.1,
                    skip: choice === 'skip' ? 0.8 : 0.1,
                  },
                },
              },
            },
          },
        },
        { 'mcp-session-id': sessionId },
      );
      return;
    }

    res.writeHead(400).end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    token,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
