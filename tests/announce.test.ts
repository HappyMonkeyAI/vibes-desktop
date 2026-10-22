import { describe, expect, it, vi } from 'vitest';
import { announceToDaemon, buildAnnounceEvent, missionAnnounceText } from '../src/main/voice/announce';

describe('announce (T24)', () => {
  it('builds a schema-v1 announcement event', () => {
    const event = buildAnnounceEvent({ text: 'Mission complete: header', priority: 5 });
    expect(event.version).toBe('1');
    expect(event.text).toContain('Mission complete');
    expect(event.priority).toBe(5);
    expect(event.source.name).toBe('vibes-desktop');
  });

  it('posts to /v1/announce and accepts 202', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 202,
      json: async () => ({ id: 'evt-1', accepted: true }),
      text: async () => '',
    });
    const result = await announceToDaemon(
      { baseUrl: 'http://127.0.0.1:4100', token: 'tok' },
      { text: 'hello' },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalled();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:4100/v1/announce');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('soft-fails without config', async () => {
    const result = await announceToDaemon({ baseUrl: '', token: '' }, { text: 'x' });
    expect(result.ok).toBe(false);
  });

  it('formats mission announce text', () => {
    expect(missionAnnounceText('done', 'Add header')).toMatch(/complete/i);
    expect(missionAnnounceText('failed', 'Add header', 'css_orphan')).toMatch(/failed/i);
  });
});
