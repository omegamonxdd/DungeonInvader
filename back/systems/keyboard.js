/* Código de teclado normalizado para los atajos del juego y de la interfaz.
 *
 * `event.code` identifica la tecla física y es la fuente principal (igual que
 * en el legacy). Algunos eventos sintéticos —y ciertos teclados— solo
 * informan de `event.key`; en ese caso se reconstruye el código equivalente
 * para que Z/X/C, E y las pestañas 1–5 sigan funcionando.
 */
export function keyCodeOf(event) {
  if (event.code) return event.code;
  const key = event.key || '';
  if (key.length === 1 && /[a-z]/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[1-9]$/.test(key)) return `Digit${key}`;
  return key; // Escape, ArrowUp, Space, …
}
