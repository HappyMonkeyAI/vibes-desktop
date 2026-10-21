import type { AppSettings, DecisionMcpConfig } from '@shared/channels';
import type { SettingsStore } from '../settings/store';

/**
 * Resolve the optional KEV/GUTSY decision MCP endpoint.
 * Empty Settings URL (and no env fallback) → null → callers must skip decision calls.
 */
export function resolveDecisionMcpConfig(store: SettingsStore | undefined): DecisionMcpConfig | null {
  if (!store) return null;
  const view = store.get();
  const url = view.decisionMcpUrl.trim() || (process.env['KEV_MCP_URL'] ?? '').trim();
  if (!url) return null;
  const token = store.getDecisionMcpAuthToken()?.trim()
    || (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim();
  if (!token) return null;
  return { url, token };
}

/** Renderer-safe flag from an AppSettings snapshot. */
export function decisionModelEnabledFromSettings(settings: AppSettings): boolean {
  return Boolean(settings.decisionMcpUrl.trim() && settings.decisionMcpHasToken);
}
