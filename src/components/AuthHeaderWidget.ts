import { authClient } from '@/services/auth-client';
import { subscribeAuthState } from '@/services/auth-state';
import type { AuthSession } from '@/services/auth-state';
import { trackSignOut } from '@/services/analytics';

const AVATAR_COLORS = [
  '#5B6EE8', '#E85B8A', '#5BC8E8', '#E8A85B',
  '#8A5BE8', '#5BE87E', '#E8675B', '#5BE8C7',
];

export class AuthHeaderWidget {
  private container: HTMLElement;
  private unsubscribeAuth: (() => void) | null = null;
  private onSignInClick: () => void;
  private dropdownOpen = false;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(onSignInClick: () => void, onSettingsClick?: () => void) {
    void onSettingsClick; // Settings accessible via gear icon in header
    this.onSignInClick = onSignInClick;
    this.container = document.createElement('div');
    this.container.className = 'auth-header-widget';

    this.unsubscribeAuth = subscribeAuthState((state: AuthSession) => {
      if (state.isPending) {
        this.container.innerHTML = '';
        return;
      }
      this.render(state);
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    this.closeDropdown();
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  }

  private getAvatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
  }

  private buildAvatar(name: string, email: string, image: string | null | undefined, size: 'sm' | 'lg'): string {
    const px = size === 'lg' ? 44 : 32;
    const fs = size === 'lg' ? '16px' : '13px';
    const color = this.getAvatarColor(email);

    if (image) {
      return `<img class="auth-avatar-img" src="${this.escapeAttr(image)}" alt="${this.escapeAttr(name ?? '')}" width="${px}" height="${px}" style="width:${px}px;height:${px}px" />`;
    }

    const initials = this.getInitials(name);
    const letter = initials !== '?' ? this.escapeHtml(initials) : '?';
    return `<span class="auth-avatar-initials" style="font-size:${fs};width:${px}px;height:${px}px;background:${color}">${letter}</span>`;
  }

  private render(state: AuthSession): void {
    this.closeDropdown();

    if (!state.user) {
      this.container.innerHTML = `<button class="auth-signin-btn">Sign In</button>`;
      this.container.querySelector<HTMLButtonElement>('.auth-signin-btn')
        ?.addEventListener('click', () => this.onSignInClick());
      return;
    }

    const user = state.user;
    const isPro = user.role === 'pro';
    const tierLabel = isPro ? 'Pro' : 'Free';
    const tierClass = isPro ? 'auth-tier-badge auth-tier-badge-pro' : 'auth-tier-badge';
    const avatarSm = this.buildAvatar(user.name, user.email, user.image, 'sm');
    const avatarLg = this.buildAvatar(user.name, user.email, user.image, 'lg');
    const color = this.getAvatarColor(user.email);

    this.container.innerHTML = `
      <button class="auth-avatar-btn" aria-label="Account menu" aria-expanded="false" style="background:${user.image ? 'transparent' : color}">${avatarSm}</button>
      <div class="auth-dropdown" role="menu">
        <div class="auth-dropdown-header">
          <div class="auth-dropdown-avatar-wrap" style="background:${user.image ? 'transparent' : color}">${avatarLg}</div>
          <div class="auth-dropdown-info">
            <strong class="auth-dropdown-name">${this.escapeHtml(user.name ?? 'User')}</strong>
            <span class="auth-dropdown-email">${this.escapeHtml(user.email)}</span>
            <span class="${tierClass}">${tierLabel}</span>
          </div>
        </div>
        <div class="auth-dropdown-divider"></div>
        <div class="auth-profile-edit" id="authProfileEdit" style="display:none">
          <div class="auth-profile-edit-field">
            <label class="auth-profile-label" for="authNameInput">Display Name</label>
            <input id="authNameInput" class="auth-profile-input" type="text" value="${this.escapeAttr(user.name ?? '')}" placeholder="Your name" maxlength="60" autocomplete="name" />
          </div>
          <div class="auth-profile-edit-actions">
            <button class="auth-profile-save-btn">Save</button>
            <button class="auth-profile-cancel-btn">Cancel</button>
          </div>
          <div class="auth-profile-msg" id="authProfileMsg"></div>
        </div>
        <button class="auth-dropdown-item" id="authEditProfileBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Profile
        </button>
        <div class="auth-dropdown-divider"></div>
        <button class="auth-dropdown-item auth-signout-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
      </div>
    `;

    this.container.querySelector<HTMLButtonElement>('.auth-avatar-btn')
      ?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dropdownOpen ? this.closeDropdown() : this.openDropdown();
      });

    this.container.querySelector<HTMLButtonElement>('#authEditProfileBtn')
      ?.addEventListener('click', () => this.toggleEditMode(true));

    this.container.querySelector<HTMLButtonElement>('.auth-profile-cancel-btn')
      ?.addEventListener('click', () => this.toggleEditMode(false));

    this.container.querySelector<HTMLButtonElement>('.auth-profile-save-btn')
      ?.addEventListener('click', () => this.saveProfile());

    this.container.querySelector<HTMLButtonElement>('.auth-signout-item')
      ?.addEventListener('click', async () => {
        trackSignOut();
        try {
          await authClient.signOut();
        } catch (err) {
          console.warn('[auth-widget] Sign out error:', err);
        }
      });
  }

  private toggleEditMode(show: boolean): void {
    const editSection = this.container.querySelector<HTMLElement>('#authProfileEdit');
    const editBtn = this.container.querySelector<HTMLButtonElement>('#authEditProfileBtn');
    if (!editSection) return;
    editSection.style.display = show ? 'block' : 'none';
    if (editBtn) editBtn.style.display = show ? 'none' : '';
    if (show) {
      this.container.querySelector<HTMLInputElement>('#authNameInput')?.focus();
    }
  }

  private async saveProfile(): Promise<void> {
    const nameInput = this.container.querySelector<HTMLInputElement>('#authNameInput');
    const msg = this.container.querySelector<HTMLElement>('#authProfileMsg');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
      if (msg) msg.textContent = 'Name cannot be empty.';
      return;
    }

    const saveBtn = this.container.querySelector<HTMLButtonElement>('.auth-profile-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    if (msg) { msg.textContent = ''; msg.className = 'auth-profile-msg'; }

    const updateUser = (authClient as Record<string, unknown>)['updateUser'];
    if (typeof updateUser !== 'function') {
      if (msg) { msg.textContent = 'Profile updates not available.'; msg.className = 'auth-profile-msg auth-profile-msg-err'; }
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    try {
      await (updateUser as (data: { name: string }) => Promise<unknown>).call(authClient, { name });
      if (msg) { msg.textContent = 'Saved!'; msg.className = 'auth-profile-msg auth-profile-msg-ok'; }
      setTimeout(() => this.toggleEditMode(false), 900);
    } catch (err) {
      console.warn('[auth-widget] Profile update error:', err);
      if (msg) { msg.textContent = 'Failed to save. Try again.'; msg.className = 'auth-profile-msg auth-profile-msg-err'; }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  private openDropdown(): void {
    const dropdown = this.container.querySelector<HTMLElement>('.auth-dropdown');
    const avatarBtn = this.container.querySelector<HTMLButtonElement>('.auth-avatar-btn');
    if (!dropdown) return;
    dropdown.classList.add('open');
    avatarBtn?.setAttribute('aria-expanded', 'true');
    this.dropdownOpen = true;

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.container.contains(e.target as Node)) this.closeDropdown();
    };
    document.addEventListener('click', this.outsideClickHandler);

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeDropdown();
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  private closeDropdown(): void {
    const dropdown = this.container.querySelector<HTMLElement>('.auth-dropdown');
    const avatarBtn = this.container.querySelector<HTMLButtonElement>('.auth-avatar-btn');
    if (dropdown) dropdown.classList.remove('open');
    avatarBtn?.setAttribute('aria-expanded', 'false');
    this.dropdownOpen = false;

    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = null;
    }
  }

  private getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '?';
    if (parts.length === 1) return first.toUpperCase();
    return (first + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  private escapeHtml(str: string): string {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  private escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
