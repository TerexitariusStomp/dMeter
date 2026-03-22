/**
 * Clerk JS initialization and thin wrapper.
 *
 * Uses dynamic import so the module is safe to import in Node.js test
 * environments where @clerk/clerk-js (browser-only) is not available.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClerkInstance = any;

const PUBLISHABLE_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY) as string | undefined;

let clerkInstance: ClerkInstance | null = null;
let loadPromise: Promise<void> | null = null;

/** Initialize Clerk. Call once at app startup. */
export async function initClerk(): Promise<void> {
  if (clerkInstance) return;
  if (loadPromise) return loadPromise;
  if (!PUBLISHABLE_KEY) {
    console.warn('[clerk] VITE_CLERK_PUBLISHABLE_KEY not set, auth disabled');
    return;
  }
  loadPromise = (async () => {
    const { Clerk } = await import('@clerk/clerk-js');
    const clerk = new Clerk(PUBLISHABLE_KEY);
    await clerk.load();
    clerkInstance = clerk;
  })();
  return loadPromise;
}

/** Get the initialized Clerk instance. Returns null if not loaded. */
export function getClerk(): ClerkInstance | null {
  return clerkInstance;
}

/** Open the Clerk sign-in modal. */
export function openSignIn(): void {
  clerkInstance?.openSignIn();
}

/** Sign out the current user. */
export async function signOut(): Promise<void> {
  await clerkInstance?.signOut();
}

/**
 * Get a bearer token for premium API requests.
 * Uses the 'convex' JWT template which includes the `plan` claim.
 * Returns null if no active session.
 */
export async function getClerkToken(): Promise<string | null> {
  const session = clerkInstance?.session;
  if (!session) return null;
  try {
    return await session.getToken({ template: 'convex' });
  } catch {
    return null;
  }
}

/** Get current Clerk user metadata. Returns null if signed out. */
export function getCurrentClerkUser(): { id: string; name: string; email: string; image: string | null; plan: 'free' | 'pro' } | null {
  const user = clerkInstance?.user;
  if (!user) return null;
  const plan = (user.publicMetadata as Record<string, unknown>)?.plan;
  return {
    id: user.id,
    name: user.fullName ?? user.firstName ?? 'User',
    email: user.primaryEmailAddress?.emailAddress ?? '',
    image: user.imageUrl ?? null,
    plan: plan === 'pro' ? 'pro' : 'free',
  };
}

/**
 * Subscribe to Clerk auth state changes.
 * Returns unsubscribe function.
 */
export function subscribeClerk(callback: () => void): () => void {
  if (!clerkInstance) return () => {};
  return clerkInstance.addListener(callback);
}

/**
 * Mount Clerk's UserButton component into a DOM element.
 * Returns an unmount function.
 */
export function mountUserButton(el: HTMLDivElement): () => void {
  if (!clerkInstance) return () => {};
  clerkInstance.mountUserButton(el, {
    afterSignOutUrl: window.location.href,
  });
  return () => clerkInstance?.unmountUserButton(el);
}
