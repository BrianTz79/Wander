import { reglaDeTema, type TemaPerfil } from '../lib/perfil';

/**
 * Inyecta el tema y el CSS propio de un perfil (Fase 9).
 *
 * Los dos van en el MISMO `<style>` y en este orden: primero el tema
 * (las variables `--p-*` que salen del editor de bloques) y después el CSS
 * que escribió la persona. El orden es la razón de ser del componente: con
 * la misma especificidad gana lo último, así que un
 * `:root { --p-acento: … }` en el CSS propio —que el sanitizador reescribe
 * al contenedor— sobreescribe el acento del tema. Si el tema fuera un
 * estilo en línea, como era antes, ganaría siempre él y redefinir
 * variables no serviría de nada.
 *
 * Dos cosas más que parecen detalles y no lo son:
 *
 *  - **El CSS del usuario ya viene sanitizado del servidor** y prefijado
 *    con `#perfil-<id>`. Este componente NO sanitiza nada y no debe
 *    intentarlo: si la defensa viviera en el cliente, bastaría con llamar
 *    a la API a mano para saltársela. Aquí solo se pinta.
 *  - Por eso `dangerouslySetInnerHTML` es lo correcto en este caso y no
 *    una excepción a la regla: dentro de un `<style>` el contenido es CSS,
 *    no HTML, así que no hay forma de inyectar marcado... **salvo
 *    escribiendo literalmente `</style>`**. Eso cerraría el elemento y lo
 *    de después sería HTML del documento. El parser de PostCSS del
 *    servidor no deja pasar un `</style>` suelto (no es CSS válido), pero
 *    no se depende de eso: se neutraliza aquí también, porque es una línea
 *    y el fallo sería un XSS.
 */
export function CssDePerfil({
  perfilId,
  tema,
  css,
}: {
  perfilId: string;
  tema: TemaPerfil | undefined | null;
  css: string | null | undefined;
}) {
  const hoja = [reglaDeTema(perfilId, tema), css ?? ''].join('\n\n');

  // Cinturón y tirantes: rompe cualquier `</style>` que hubiera llegado
  // hasta aquí sin cambiar lo que el CSS hace.
  const seguro = hoja.replace(/<\/(style)/gi, '<\\/$1');

  return <style dangerouslySetInnerHTML={{ __html: seguro }} />;
}
