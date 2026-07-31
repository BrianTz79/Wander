/**
 * Inyecta el CSS propio de un perfil (Fase 9).
 *
 * Se pinta como un `<style>` normal dentro del árbol de React. Dos cosas
 * que parecen detalles y no lo son:
 *
 *  - **El CSS que llega aquí ya viene sanitizado del servidor** y prefijado
 *    con `#perfil-<id>`. Este componente NO sanitiza nada y no debe
 *    intentarlo: si la defensa viviera en el cliente, bastaría con llamar
 *    a la API a mano para saltársela. Aquí solo se pinta.
 *  - Por eso mismo `dangerouslySetInnerHTML` es lo correcto en este caso
 *    concreto y no una excepción a la regla: dentro de un `<style>` el
 *    contenido es CSS, no HTML, así que no hay forma de cerrar la etiqueta
 *    e inyectar marcado... **salvo escribiendo literalmente `</style>`**.
 *    Eso sí cerraría el elemento y lo que viniera detrás sería HTML del
 *    documento. El parser de PostCSS del servidor no deja pasar un
 *    `</style>` suelto (no es CSS válido), pero no se depende de eso: se
 *    neutraliza aquí también, porque es una línea y el fallo sería un XSS.
 */
export function CssDePerfil({ css }: { css: string | null | undefined }) {
  if (!css) return null;

  // Cinturón y tirantes: rompe cualquier `</style>` que hubiera llegado
  // hasta aquí sin cambiar lo que el CSS hace.
  const seguro = css.replace(/<\/(style)/gi, '<\\/$1');

  return <style dangerouslySetInnerHTML={{ __html: seguro }} />;
}
