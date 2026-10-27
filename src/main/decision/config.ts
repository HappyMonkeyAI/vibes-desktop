import type { AppSettings, DecisionMcpConfig } from '@shared/channels';
import type { SettingsStore } from '../settings/store';

function looksLikeUnslothStudio(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('unsloth') || u.includes(':8888');
}

/** Bearer candidates: Settings → KEV env → Unsloth Studio env aliases (Studio URLs only). */
function resolveDecisionToken(store: SettingsStore, url: string): string {
  const fromStore = store.getDecisionMcpAuthToken()?.trim() ?? '';
  if (fromStore) return fromStore;
  const fromKev = (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim();
  if (fromKev) return fromKev;
  if (looksLikeUnslothStudio(url)) {
    return (
      (process.env['UNSLOTH_API_KEY'] ?? '').trim()
      || (process.env['UNSLOTH_STUDIO_API_KEY'] ?? '').trim()
    );
  }
  return '';
}

/**
 * Resolve the optional decision MCP endpoint (KEV / Unsloth Studio).
 * Empty Settings URL (and no env fallback) → null → callers must skip decision calls.
 */
export function resolveDecisionMcpConfig(store: SettingsStore | undefined): DecisionMcpConfig | null {
  if (!store) return null;
  const view = store.get();
  const url = view.decisionMcpUrl.trim() || (process.env['KEV_MCP_URL'] ?? '').trim();
  if (!url) return null;
  const token = resolveDecisionToken(store, url);
  if (!token) return null;
  return { url, token };
}

/** Renderer-safe flag from an AppSettings snapshot. */
export function decisionModelEnabledFromSettings(settings: AppSettings): boolean {
  return Boolean(settings.decisionMcpUrl.trim() && settings.decisionMcpHasToken);
}
