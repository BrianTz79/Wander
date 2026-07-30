import type { Bloque } from '../../lib/perfil';

/**
 * Bloque de texto libre. `whitespace-pre-wrap` respeta los saltos de
 * línea del usuario sin necesidad de HTML — y por eso mismo es inmune a
 * XSS: el contenido jamás se interpreta, solo se muestra.
 */
export function BloqueTexto({ bloque }: { bloque: Bloque }) {
  const titulo = typeof bloque.config['titulo'] === 'string' ? bloque.config['titulo'] : '';
  const contenido = typeof bloque.config['contenido'] === 'string' ? bloque.config['contenido'] : '';

  if (!titulo && !contenido) return null;

  return (
    <section
      className="p-6"
      style={{
        backgroundColor: 'var(--p-tarjeta)',
        border: '1px solid var(--p-borde)',
        borderRadius: 'var(--p-radio)',
      }}
    >
      {titulo && <h2 className="mb-3 text-xl font-bold">{titulo}</h2>}
      {contenido && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ opacity: 0.85 }}>
          {contenido}
        </p>
      )}
    </section>
  );
}
