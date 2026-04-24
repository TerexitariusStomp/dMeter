import type { AuthSession } from './auth-state';

export enum PanelGateReason {
  NONE = 'none',           // show content (pro user, or desktop with API key, or non-premium panel)
  ANONYMOUS = 'anonymous', // "Sign In to Unlock"
  FREE_TIER = 'free_tier', // "Upgrade to Pro"
}
/**
 * Single source of truth for premium access.
 * For dMeter single version: everything unlocked.
 */
export function hasPremiumAccess(_authState?: AuthSession): boolean {
  return true; // single version — everything unlocked
}

/**
 * Always return NONE for single version.
 */
export function getPanelGateReason(
  _authState: AuthSession,
  _isPremium: boolean,
): PanelGateReason {
  return PanelGateReason.NONE; // single version — no gating
}
