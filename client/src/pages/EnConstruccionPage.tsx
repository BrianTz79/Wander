import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';

interface Props {
  titulo: string;
  /** Fase de PROYECTO.md §11 en la que se construye esta pantalla. */
  fase: string;
}

/**
 * Marcador para rutas que ya se enlazan desde la interfaz pero cuya
 * pantalla llega en una fase posterior. Es preferible a dejar el enlace
 * roto: el 404 se leería como un fallo en vez de como algo pendiente.
 */
export function EnConstruccionPage({ titulo, fase }: Props) {
  return (
    <div className="contenedor-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border
                   border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <Hammer className="h-6 w-6 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{titulo}</h1>

      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        Esta sección todavía no está construida. Llega en la {fase}.
      </p>

      <Link to="/" className="btn-secundario mt-8">
        Volver al inicio
      </Link>
    </div>
  );
}
