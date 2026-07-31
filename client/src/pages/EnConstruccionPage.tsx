import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hammer } from 'lucide-react';

interface Props {
  /** Clave del catálogo con el nombre de la sección. */
  claveTitulo: 'explorar' | 'actividad' | 'mensajes';
  /** Clave de la fase de PROYECTO.md §11 en la que se construye esta pantalla. */
  claveFase: 'fase7' | 'fase8';
}

/**
 * Marcador para rutas que ya se enlazan desde la interfaz pero cuya
 * pantalla llega en una fase posterior. Es preferible a dejar el enlace
 * roto: el 404 se leería como un fallo en vez de como algo pendiente.
 *
 * Recibe **claves** y no textos ya traducidos: si `App` pasara el resultado
 * de `t()`, el texto se resolvería en el render del padre y no se
 * actualizaría al cambiar de idioma sin recargar.
 */
export function EnConstruccionPage({ claveTitulo, claveFase }: Props) {
  const { t } = useTranslation();

  return (
    <div className="contenedor-app flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border
                   border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <Hammer className="h-6 w-6 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t(`enConstruccion.${claveTitulo}`)}
      </h1>

      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        {t('enConstruccion.texto', { fase: t(`enConstruccion.${claveFase}`) })}
      </p>

      <Link to="/" className="btn-secundario mt-8">
        {t('comun.volverInicio')}
      </Link>
    </div>
  );
}
