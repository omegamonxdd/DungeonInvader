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
    this.mode = 'login'; // login | register | forgot | reset
    this.resetEmail = '';
    this.els = {
      overlay: byId('auth-overlay'),
      form: byId('auth-form'),
      username: byId('auth-username'),
      nameField: byId('auth-name-field'),
      emailField: byId('auth-email-field'),
      email: byId('auth-email'),
      passwordField: byId('auth-password-field'),
      password: byId('auth-password'),
      newPasswordField: byId('auth-new-password-field'),
      newPassword: byId('auth-new-password'),
      error: byId('auth-error'),
      submit: byId('auth-submit'),
      guest: byId('auth-guest'),
      forgotRow: byId('auth-forgot-row'),
      forgotLink: byId('auth-forgot-link'),
      note: byId('auth-note'),
      sub: byId('auth-sub'),
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
    this.service.auth?.onRecovery?.(() => {
      this.show();
      this.setMode('reset');
      this.setError('Enlace verificado. Escribe tu nueva contraseña.');
      requestAnimationFrame(() => this.els.newPassword?.focus());
    });
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
    this.els.forgotLink?.addEventListener('click', () => this.setMode('forgot'));
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
      // Tras cerrar sesión se vuelve al login; la escena queda en partida
      // limpia detrás del modal (GameService ya borró el caché local).
      if (!error) this.show();
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
    const allowed = ['login', 'register', 'forgot', 'reset'];
    this.mode = allowed.includes(mode) ? mode : 'login';
    for (const tab of this.els.tabs) {
      const on = tab.dataset.mode === this.mode || (this.mode === 'reset' && tab.dataset.mode === 'login') || (this.mode === 'forgot' && tab.dataset.mode === 'login');
      const active = tab.dataset.mode === this.mode || (this.mode === 'register' ? tab.dataset.mode === 'register' : tab.dataset.mode === 'login');
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    }

    const registering = this.mode === 'register';
    const forgot = this.mode === 'forgot';
    const reset = this.mode === 'reset';
    const loginLike = this.mode === 'login' || registering;

    if (this.els.sub) {
      this.els.sub.textContent = forgot
        ? 'Escribe tu correo y te enviaremos un enlace para cambiar la contraseña.'
        : reset
          ? 'Escribe tu nueva contraseña.'
          : 'Entra para guardar tu mazmorra y continuar donde la dejaste.';
    }
    if (this.els.submit) {
      this.els.submit.textContent = registering ? 'Crear cuenta'
        : forgot ? 'Enviar enlace'
        : reset ? 'Cambiar contraseña'
        : 'Entrar';
    }

    if (this.els.nameField) this.els.nameField.hidden = !registering;
    if (this.els.username) { this.els.username.required = registering; if (!registering) this.els.username.value = ''; }

    if (this.els.emailField) this.els.emailField.hidden = reset;
    if (this.els.email) { this.els.email.required = !reset; if (reset) this.els.email.value = this.resetEmail; }

    if (this.els.passwordField) this.els.passwordField.hidden = !loginLike;
    if (this.els.password) {
      this.els.password.required = loginLike;
      this.els.password.autocomplete = registering ? 'new-password' : 'current-password';
      if (!loginLike) this.els.password.value = '';
    }

    if (this.els.newPasswordField) this.els.newPasswordField.hidden = !reset;
    if (this.els.newPassword) { this.els.newPassword.required = reset; if (!reset) this.els.newPassword.value = ''; }

    if (this.els.forgotRow) this.els.forgotRow.hidden = !loginLike;
    if (this.els.guest) this.els.guest.hidden = !loginLike;

    this.setError('');
  }

  setError(msg) {
    if (!this.els.error) return;
    this.els.error.textContent = msg || '';
    this.els.error.hidden = !msg;
  }

  async onSubmit(e) {
    e.preventDefault();
    const email = this.els.email?.value.trim() || '';
    const password = this.els.password?.value || '';
    const username = this.mode === 'register' ? (this.els.username?.value.trim() || '') : '';
    const newPassword = this.els.newPassword?.value || '';

    if (this.mode === 'register' && (!email || !password || !username)) {
      this.setError('Escribe tu nombre de usuario, correo y contraseña.'); return;
    }
    if (this.mode === 'login' && (!email || !password)) {
      this.setError('Escribe tu correo y tu contraseña.'); return;
    }
    if (this.mode === 'forgot' && !email) {
      this.setError('Escribe tu correo electrónico.'); return;
    }
    if (this.mode === 'reset' && !newPassword) {
      this.setError('Escribe tu nueva contraseña.'); return;
    }

    this.setError('');
    if (this.els.submit) this.els.submit.disabled = true;

    if (this.mode === 'register') {
      const { error, needsConfirmation } = await this.service.signUp(email, password, username);
      if (this.els.submit) this.els.submit.disabled = false;
      if (error) { this.setError(error); return; }
      if (needsConfirmation) { this.setError('Revisa tu correo para confirmar la cuenta y vuelve a entrar.'); return; }
      this.hide(); return;
    }

    if (this.mode === 'forgot') {
      const { error } = await this.service.requestPasswordReset(email);
      if (this.els.submit) this.els.submit.disabled = false;
      if (error) { this.setError(error); return; }
      this.setError('Te enviamos un enlace a tu correo. Ábrelo para cambiar tu contraseña.');
      return;
    }

    if (this.mode === 'reset') {
      const { error } = await this.service.updatePassword(newPassword);
      if (this.els.submit) this.els.submit.disabled = false;
      if (error) { this.setError(error); return; }
      this.resetEmail = '';
      this.setError('');
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
