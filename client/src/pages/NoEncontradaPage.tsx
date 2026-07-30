import { Link } from 'react-router-dom';

/** 404. */
export function NoEncontradaPage() {
  return (
    <div className="contenedor-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-sm font-medium text-zinc-500 dark:text-zinc-400">404</p>

      <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Esta página no existe
      </h1>

      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        Puede que el enlace esté mal escrito, o que el perfil que buscas haya cambiado de nombre.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primario">
          Volver al inicio
        </Link>
        <Link to="/explorar" className="btn-secundario">
          Explorar perfiles
        </Link>
      </div>
    </div>
  );
}
