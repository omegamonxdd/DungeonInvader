/* ==========================================================
 * INTERFAZ DE INICIO DE SESIÓN
 * ----------------------------------------------------------
 * Panel modal ligero (HTML en index.html, estilos en
 * front/css/modales/04-auth.css) + chip con el estado del guardado.
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
      email: byId('auth-email'),
      password: byId('auth-password'),
      error: byId('auth-error'),
      submit: byId('auth-submit'),
      guest: byId('auth-guest'),
      note: byId('auth-note'),
      tabs: [...document.querySelectorAll('#auth-overlay [data-mode]')],
      bar: byId('auth-bar'),
      chip: byId('auth-chip'),
      chipLabel: byId('auth-chip-label'),
      chipStatus: byId('auth-chip-status'),
      logout: byId('auth-logout'),
    };
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
    this.els.chip?.addEventListener('click', () => {
      if (this.service.auth.isGuest) this.show();
    });
    this.els.logout?.addEventListener('click', async () => {
      this.els.logout.disabled = true;
      const { error } = await this.service.signOut();
      if (error) this.setError(error);
      this.els.logout.disabled = false;
    });
  }

  setMode(mode) {
    this.mode = mode === 'register' ? 'register' : 'login';
    for (const tab of this.els.tabs) {
      const on = tab.dataset.mode === this.mode;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    if (this.els.submit) this.els.submit.textContent = this.mode === 'register' ? 'Crear cuenta' : 'Entrar';
    if (this.els.password) this.els.password.autocomplete = this.mode === 'register' ? 'new-password' : 'current-password';
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
    if (!email || !password) {
      this.setError('Escribe tu correo y tu contraseña.');
      return;
    }
    this.setError('');
    if (this.els.submit) this.els.submit.disabled = true;
    const fn = this.mode === 'register' ? this.service.signUp : this.service.signIn;
    const { error, needsConfirmation } = await fn.call(this.service, email, password);
    if (this.els.submit) this.els.submit.disabled = false;
    if (error) { this.setError(error); return; }
    if (needsConfirmation) {
      this.setError('Revisa tu correo para confirmar la cuenta y vuelve a entrar.');
      return;
    }
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
    const { user, status, configured } = state;
    const label = user.guest
      ? 'Invitado'
      : (user.email || user.id.slice(0, 8));
    if (this.els.chipLabel) this.els.chipLabel.textContent = label;
    if (this.els.chipStatus) this.els.chipStatus.textContent = STATUS_TEXT[status] || status;
    if (this.els.bar) this.els.bar.hidden = false;
    if (this.els.chip) {
      this.els.chip.classList.toggle('guest', user.guest);
      this.els.chip.classList.toggle('offline', !configured);
      this.els.chip.title = user.guest
        ? 'Progreso guardado en este navegador. Pulsa para iniciar sesión.'
        : `Sesión de ${user.email || user.id}`;
    }
    if (this.els.logout) this.els.logout.hidden = user.guest;
    // Si la sesión se restauró al arrancar, cerramos el modal automáticamente.
    if (!user.guest && this.els.overlay && !this.els.overlay.hidden) this.hide();
  }
}
