import type { Bloque, UsuarioPerfil } from '../../lib/perfil';
import { TEXTO_SUAVE } from '../../lib/perfil';

/**
 * Bloque Hero: identidad del perfil. Avatar (o inicial), nombre, handle,
 * tagline y bio. Todo se pinta como TEXTO de React — nunca HTML — así que
 * lo que escriba el usuario no puede ejecutar nada.
 */
export function BloqueHero({ bloque, usuario }: { bloque: Bloque; usuario: UsuarioPerfil }) {
  const tagline = typeof bloque.config['tagline'] === 'string' ? bloque.config['tagline'] : '';
  const mostrarBio = bloque.config['mostrarBio'] !== false;

  return (
    <header className="flex flex-col items-center gap-4 py-10 text-center">
      {usuario.avatarUrl ? (
        <img
          src={usuario.avatarUrl}
          alt=""
          className="h-24 w-24 rounded-full object-cover"
          style={{ border: '2px solid var(--p-borde)' }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold"
          style={{
            backgroundColor: 'var(--p-tarjeta)',
            border: '2px solid var(--p-borde)',
            color: 'var(--p-acento)',
          }}
        >
          {usuario.displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{usuario.displayName}</h1>
        <p className="mt-1 font-mono text-sm" style={{ color: 'var(--p-acento)' }}>
          @{usuario.handle}
        </p>
      </div>

      {tagline && <p className="max-w-md text-lg font-medium">{tagline}</p>}

      {mostrarBio && usuario.bio && (
        <p className="max-w-lg whitespace-pre-wrap text-sm leading-relaxed" style={TEXTO_SUAVE}>
          {usuario.bio}
        </p>
      )}
    </header>
  );
}
