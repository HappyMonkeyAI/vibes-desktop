import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

/**
 * T3 — Generic JSON-RPC 2.0 client over a child process's stdio.
 * Ported from vibes-dashboard/server/vibes-bridge.js (sendRequest/handleMessage),
 * generalized so the transport is testable without spawning anything.
 *
 * Wire format: one JSON object per line on stdout; requests written to stdin.
 * Non-JSON stdout lines are emitted as 'log'. A dead/unspawned process rejects
 * pending requests instead of hanging them.
 */

export interface JsonRpcErrorObject {
  code: number;
  message: string;
}

export interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: JsonRpcErrorObject;
}

type Pending = { resolve: (value: unknown) => void; reject: (err: Error) => void };

const DEFAULT_TIMEOUT_MS = 30_000;

export class JsonRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, Pending>();
  private buffer = '';
  private stderrBuffer = '';

  /** Attach the client to a running child process and start draining stdio. */
  attach(proc: ChildProcess): void {
    this.process = proc;
    const stdout = proc.stdout;
    const stderr = proc.stderr;
    if (!stdout || !stderr) return;

    stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) this.handleMessage(line.trim());
      }
    });

    stderr.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString();
      const lines = this.stderrBuffer.split('\n');
      this.stderrBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.emit('log', trimmed);
      }
    });

    proc.on('error', (err: Error) => {
      this.rejectAll(new Error(`child process spawn error: ${err.message}`));
      this.emit('error', err);
    });

    proc.on('exit', (code: number | null) => {
      this.rejectAll(new Error(`child process exited with code ${code ?? 'unknown'}`));
      this.emit('exit', code);
    });
  }

  /** Send a request and await its correlated response. */
  sendRequest(method: string, params: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const stdin = this.process?.stdin;
      if (!stdin || !stdin.writable) {
        reject(new Error('child process not running'));
        return;
      }

      const id = ++this.requestId;
      this.pending.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`request ${method} timed out after ${Math.round(timeoutMs / 1000)}s`));
        }
      }, timeoutMs);

      stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (err) => {
        if (err && this.pending.delete(id)) reject(err);
      });
    });
  }

  /** Handle one stdout line: correlated response or non-JSON log. */
  handleMessage(line: string): void {
    let response: JsonRpcResponse;
    try {
      response = JSON.parse(line) as JsonRpcResponse;
    } catch {
      this.emit('log', line);
      return;
    }
    if (typeof response.id !== 'number' || !this.pending.has(response.id)) return;
    const pending = this.pending.get(response.id)!;
    this.pending.delete(response.id);
    if (response.error) {
      pending.reject(new Error(response.error.message || `JSON-RPC error ${response.error.code}`));
    } else {
      pending.resolve(response.result);
    }
  }

  /** Reject everything outstanding (shutdown / crash). */
  rejectAll(err: Error): void {
    for (const pending of this.pending.values()) pending.reject(err);
    this.pending.clear();
  }

  get isRunning(): boolean {
    const stdin = this.process?.stdin;
    return !!stdin && stdin.writable;
  }
}
