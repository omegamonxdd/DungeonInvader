/* ==========================================================
 * INTERFAZ DE INICIO DE SESIÓN
 * ----------------------------------------------------------
 * Panel modal ligero (HTML en index.html, estilos en
 * front/css/modales/04-auth.css) + icono de perfil junto a los ajustes de
 * teclado: al pulsarlo muestra la sesión (correo) y Cerrar sesión.
 * No conoce Supabase directamente: solo habla con GameService.
 * ========================================================== */

const byId = id => document.getElementById(id);

const STATUS_TEXT = {
  idle: 'Listo',
  loading: 'Cargando…',
  saving: 'Guardando…',
  saved: 'Guardado',
  offline: 'Guardado local',
  error: 'Error al guardar',
};

export class AuthUI {
  constructor(service) {
    this.service = service;
    this.mode = 'login';
    this.els = {
      overlay: byId('auth-overlay'),
      form: byId('auth-form'),
      username: byId('auth-username'),
      nameField: byId('auth-name-field'),
      email: byId('auth-email'),
      password: byId('auth-password'),
      error: byId('auth-error'),
      submit: byId('auth-submit'),
      guest: byId('auth-guest'),
      note: byId('auth-note'),
      tabs: [...document.querySelectorAll('#auth-overlay [data-mode]')],
      profileBtn: byId('profile-btn'),
      popover: byId('profile-popover'),
      nameLabel: byId('profile-name'),
      emailLabel: byId('profile-email'),
      statusLabel: byId('profile-status'),
      login: byId('profile-login'),
      logout: byId('profile-logout'),
    };
    this.popoverOpen = false;
    this.bind();
    this.service.onStatus(state => this.renderStatus(state));
  }

  bind() {
    for (const tab of this.els.tabs) {
      tab?.addEventListener('click', () => this.setMode(tab.dataset.mode));
    }
    this.els.form?.addEventListener('submit', e => this.onSubmit(e));
    this.els.guest?.addEventListener('click', () => {
      this.service.continueAsGuest();
      this.hide();
    });
    this.els.profileBtn?.addEventListener('click', e => {
      e.stopPropagation();
      if (this.popoverOpen) this.closeProfile();
      else this.openProfile();
    });
    this.els.popover?.addEventListener('pointerdown', e => e.stopPropagation());
    document.addEventListener('pointerdown', e => {
      if (this.popoverOpen && !this.els.profileBtn?.contains(e.target)) this.closeProfile();
    });
    this.els.login?.addEventListener('click', () => {
      this.closeProfile();
      this.show();
    });
    this.els.logout?.addEventListener('click', async () => {
      this.els.logout.disabled = true;
      const { error } = await this.service.signOut();
      if (error) this.setError(error);
      this.els.logout.disabled = false;
      this.closeProfile();
    });
  }

  openProfile() {
    if (!this.els.popover) return;
    this.els.popover.hidden = false;
    this.popoverOpen = true;
    this.els.profileBtn?.setAttribute('aria-expanded', 'true');
  }

  closeProfile() {
    if (!this.els.popover) return;
    this.els.popover.hidden = true;
    this.popoverOpen = false;
    this.els.profileBtn?.setAttribute('aria-expanded', 'false');
  }

  setMode(mode) {
    this.mode = mode === 'register' ? 'register' : 'login';
    for (const tab of this.els.tabs) {
      const on = tab.dataset.mode === this.mode;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    const registering = this.mode === 'register';
    if (this.els.submit) this.els.submit.textContent = registering ? 'Crear cuenta' : 'Entrar';
    if (this.els.password) this.els.password.autocomplete = registering ? 'new-password' : 'current-password';
    if (this.els.nameField) this.els.nameField.hidden = !registering;
    if (this.els.username) {
      this.els.username.required = registering;
      if (!registering) this.els.username.value = '';
    }
    this.setError('');
  }

  setError(msg) {
    if (!this.els.error) return;
    this.els.error.textContent = msg || '';
    this.els.error.hidden = !msg;
  }

  async onSubmit(e) {
    e.preventDefault();
    const email = this.els.email?.value.trim();
    const password = this.els.password?.value || '';
    const username = this.mode === 'register' ? (this.els.username?.value.trim() || '') : '';
    if (!email || !password || (this.mode === 'register' && !username)) {
      this.setError(this.mode === 'register'
        ? 'Escribe tu nombre de usuario, correo y contraseña.'
        : 'Escribe tu correo y tu contraseña.');
      return;
    }
    this.setError('');
    if (this.els.submit) this.els.submit.disabled = true;
    if (this.mode === 'register') {
      const { error, needsConfirmation } = await this.service.signUp(email, password, username);
      if (this.els.submit) this.els.submit.disabled = false;
      if (error) { this.setError(error); return; }
      if (needsConfirmation) {
        this.setError('Revisa tu correo para confirmar la cuenta y vuelve a entrar.');
        return;
      }
      this.hide();
      return;
    }
    const { error } = await this.service.signIn(email, password);
    if (this.els.submit) this.els.submit.disabled = false;
    if (error) { this.setError(error); return; }
    this.hide();
  }

  show() {
    if (!this.els.overlay) return;
    this.els.overlay.hidden = false;
    document.body.classList.add('auth-open');
    this.setMode('login');
    requestAnimationFrame(() => this.els.email?.focus());
  }

  hide() {
    if (!this.els.overlay) return;
    this.els.overlay.hidden = true;
    document.body.classList.remove('auth-open');
    this.setError('');
    if (this.els.password) this.els.password.value = '';
  }

  /** Llamar después de service.start(): oculta el modal si ya hay sesión. */
  ready() {
    if (!this.service.auth.isGuest) this.hide();
    else this.show();
    const note = this.service.repository.remoteEnabled
      ? 'Tu progreso se sincronizará con Supabase en este dispositivo.'
      : 'Sin Supabase: el progreso se guarda en este navegador. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para sincronizar.';
    if (this.els.note) this.els.note.textContent = note;
  }

  renderStatus(state) {
    const { user, status } = state;
    const name = user.displayName || (user.guest
      ? 'Invitado' : (user.email || user.id.slice(0, 8)));
    if (this.els.nameLabel) this.els.nameLabel.textContent = name;
    if (this.els.emailLabel) {
      this.els.emailLabel.textContent = user.guest ? '' : (user.email || '');
      this.els.emailLabel.hidden = user.guest;
    }
    if (this.els.statusLabel) this.els.statusLabel.textContent = STATUS_TEXT[status] || status;
    if (this.els.profileBtn) {
      this.els.profileBtn.title = user.guest
        ? 'Invitado · pulsa para iniciar sesión'
        : `Sesión de ${name} (${user.email || user.id})`;
    }
    if (this.els.login) this.els.login.hidden = !user.guest;
    if (this.els.logout) this.els.logout.hidden = user.guest;
    // Si la sesión se restauró al arrancar, cerramos el modal automáticamente.
    if (!user.guest && this.els.overlay && !this.els.overlay.hidden) this.hide();
  }
}
