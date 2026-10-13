import { describe, expect, it, vi } from 'vitest';
import { Readable, Writable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { JsonRpcClient } from '../src/main/bridge/jsonrpc';

/** Build a fake child process whose stdin/stdout we drive directly. */
function fakeChild() {
  const proc = new EventEmitter() as ChildProcess & {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    pid: number;
  };
  // Swallow what the client writes to stdin (a no-op sink).
  proc.stdin = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.pid = 12345;
  // Push data into the fake stdout/stderr (Readable streams are fed via push()).
  const feed = (text: string) => proc.stdout.push(text);
  const feedErr = (text: string) => proc.stderr.push(text);
  return { proc, feed, feedErr };
}

describe('JsonRpcClient (T3 transport)', () => {
  it('resolves a correlated response and rejects nothing else', async () => {
    const { proc, feed } = fakeChild();
    const client = new JsonRpcClient();
    client.attach(proc);

    const promise = client.sendRequest('initialize', { protocolVersion: '2024-11-05' });
    // The request was written as one JSON-RPC line.
    await new Promise((r) => setTimeout(r, 10));
    feed(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } }) + '\n');

    await expect(promise).resolves.toEqual({ protocolVersion: '2024-11-05' });
  });

  it('rejects on a JSON-RPC error object', async () => {
    const { proc, feed } = fakeChild();
    const client = new JsonRpcClient();
    client.attach(proc);

    const promise = client.sendRequest('tools/call', { name: 'nope' });
    await new Promise((r) => setTimeout(r, 10));
    feed(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }) + '\n');

    await expect(promise).rejects.toThrow('Method not found');
  });

  it('times out when no response arrives', async () => {
    const { proc } = fakeChild();
    const client = new JsonRpcClient();
    client.attach(proc);

    await expect(client.sendRequest('plan_mission', {}, 50)).rejects.toThrow(/timed out/);
  });

  it('emits non-JSON stdout lines as log, not errors', async () => {
    const { proc, feed } = fakeChild();
    const client = new JsonRpcClient();
    const logs: string[] = [];
    client.on('log', (line: string) => logs.push(line));
    client.attach(proc);

    feed('[DEBUG] planning mission\n');
    feed('not json at all\n');
    await new Promise((r) => setTimeout(r, 10));

    expect(logs).toEqual(['[DEBUG] planning mission', 'not json at all']);
  });

  it('rejects pending requests when the child exits', async () => {
    const { proc } = fakeChild();
    const client = new JsonRpcClient();
    const exitSpy = vi.fn();
    client.on('exit', exitSpy);
    client.attach(proc);

    const promise = client.sendRequest('query_status', {});
    await new Promise((r) => setTimeout(r, 10));
    proc.emit('exit', 1);

    await expect(promise).rejects.toThrow(/exited with code 1/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('buffers a partial line and completes it on the next chunk', async () => {
    const { proc, feed } = fakeChild();
    const client = new JsonRpcClient();
    client.attach(proc);

    const promise = client.sendRequest('initialize', {});
    await new Promise((r) => setTimeout(r, 10));
    // Split one JSON message across two chunks — the transport must reassemble.
    feed(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }).slice(0, 5));
    feed(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }).slice(5) + '\n');

    await expect(promise).resolves.toEqual({ ok: true });
  });
});
