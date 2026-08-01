import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react';

import { useAuth } from '../store/authStore';
import type { AudioPerfil } from '../lib/perfil';

/**
 * Música de fondo del perfil (Fase 11).
 *
 * Cuatro reglas de §7, y las cuatro tienen su porqué:
 *
 *  1. **El control es del VISITANTE, no del dueño del perfil.** El volumen
 *     y el silencio se guardan en el navegador y se aplican en TODOS los
 *     perfiles: nadie quiere volver a silenciar en cada uno que abre.
 *     El dueño solo propone el volumen inicial.
 *  2. **No se pelea con el autoplay del navegador.** Chrome y Safari
 *     bloquean el audio hasta que hay una interacción real con la página,
 *     y ese bloqueo es correcto —sonido inesperado es de las cosas más
 *     hostiles que puede hacer una web—. Si `play()` es rechazado, se
 *     enseña un botón de reproducir y ya está.
 *  3. **El ajuste de cuenta gana.** Quien tenga "no reproducir música en
 *     los perfiles" no oye nada, decida lo que decida el perfil.
 *  4. **Nunca arranca a todo volumen.** Aunque el dueño ponga 100, el
 *     primer sonido sale al volumen que el visitante dejó la última vez.
 */

/** Preferencias del visitante. Van en localStorage y no en la cuenta
 *  porque valen para quien no ha iniciado sesión, que es la mayoría de
 *  quien abre un perfil desde un enlace. */
const CLAVE_VOLUMEN = 'wander:volumen-perfil';
const CLAVE_SILENCIO = 'wander:silencio-perfil';

function leerVolumenGuardado(porDefecto: number): number {
  try {
    const bruto = localStorage.getItem(CLAVE_VOLUMEN);
    if (bruto === null) return porDefecto;
    const n = Number(bruto);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : porDefecto;
  } catch {
    // localStorage puede lanzar en modo privado de algunos navegadores.
    return porDefecto;
  }
}

function leerSilencioGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === '1';
  } catch {
    return false;
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin persistencia, pero la sesión sigue funcionando */
  }
}

export function ReproductorPerfil({ audio }: { audio: AudioPerfil }) {
  const { t } = useTranslation();
  const usuario = useAuth((e) => e.usuario);
  const ref = useRef<HTMLAudioElement>(null);

  const [volumen, setVolumen] = useState(() => leerVolumenGuardado(audio.audioVolumen ?? 30));
  const [silencio, setSilencio] = useState(leerSilencioGuardado);
  const [sonando, setSonando] = useState(false);
  /** El navegador rechazó el autoplay: hace falta que la persona pulse. */
  const [bloqueado, setBloqueado] = useState(false);

  // El ajuste de cuenta gana sobre todo lo demás. Se comprueba antes de
  // montar el <audio> siquiera: así ni se descarga el archivo.
  const permitido = usuario?.reproducirMusica !== false;

  // Volumen y silencio se aplican al elemento y se recuerdan.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volumen / 100;
    el.muted = silencio;
  }, [volumen, silencio]);

  /*
   * Intento de autoplay. Se hace UNA vez al montar y solo si el dueño lo
   * pidió; `play()` devuelve una promesa que el navegador rechaza cuando
   * no ha habido interacción, y ese rechazo hay que capturarlo — sin el
   * `.catch` queda una promesa no manejada en la consola de todos los
   * visitantes.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || !audio.audioAutoplay) return;

    el.play()
      .then(() => {
        setSonando(true);
        setBloqueado(false);
      })
      .catch(() => {
        // Lo normal en Chrome y Safari. No es un error que reportar.
        setSonando(false);
        setBloqueado(true);
      });
  }, [audio.audioAutoplay, audio.audioUrl]);

  if (!audio.audioUrl || !permitido) return null;

  function alternarReproduccion() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play()
        .then(() => {
          setSonando(true);
          setBloqueado(false);
        })
        .catch(() => setBloqueado(true));
    } else {
      el.pause();
      setSonando(false);
    }
  }

  function alternarSilencio() {
    setSilencio((s) => {
      const nuevo = !s;
      guardar(CLAVE_SILENCIO, nuevo ? '1' : '0');
      return nuevo;
    });
  }

  const etiqueta = [audio.audioTitulo, audio.audioArtista].filter(Boolean).join(' — ');

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2
                 items-center gap-2 rounded-full px-3 py-2 shadow-lg backdrop-blur
                 sm:left-4 sm:translate-x-0"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--p-tarjeta) 90%, transparent)',
        border: '1px solid var(--p-borde)',
        color: 'var(--p-texto)',
      }}
      role="region"
      aria-label={t('musica.reproductor')}
    >
      {/*
        `preload="none"` a propósito: sin autoplay, descargar el archivo de
        entrada le cuesta datos móviles a quien quizá nunca le dé al play.
        Con autoplay sí se precarga, porque va a sonar igualmente.
      */}
      <audio
        ref={ref}
        src={audio.audioUrl}
        loop={audio.audioLoop}
        preload={audio.audioAutoplay ? 'auto' : 'none'}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => setSonando(false)}
      />

      <button
        type="button"
        onClick={alternarReproduccion}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
        style={{ backgroundColor: 'var(--p-acento)', color: 'var(--p-fondo)' }}
        aria-label={sonando ? t('musica.pausar') : t('musica.reproducir')}
      >
        {sonando ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-xs font-medium">
          <Music className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          <span className="truncate">{etiqueta || t('musica.sinTitulo')}</span>
        </p>
        {bloqueado && (
          <p className="truncate text-[10px] opacity-60">{t('musica.pulsaParaSonar')}</p>
        )}
      </div>

      <button
        type="button"
        onClick={alternarSilencio}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        aria-label={silencio ? t('musica.activarSonido') : t('musica.silenciar')}
      >
        {silencio ? (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <label className="sr-only" htmlFor="volumen-perfil">
        {t('musica.volumen')}
      </label>
      <input
        id="volumen-perfil"
        type="range"
        min={0}
        max={100}
        value={silencio ? 0 : volumen}
        onChange={(e) => {
          const v = Number(e.target.value);
          setVolumen(v);
          guardar(CLAVE_VOLUMEN, String(v));
          // Mover el control con el sonido cortado es querer oírlo.
          if (silencio && v > 0) {
            setSilencio(false);
            guardar(CLAVE_SILENCIO, '0');
          }
        }}
        className="h-1 w-16 shrink-0 cursor-pointer accent-[var(--p-acento)]"
      />
    </div>
  );
}
