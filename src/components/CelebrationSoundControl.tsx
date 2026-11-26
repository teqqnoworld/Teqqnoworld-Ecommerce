import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Sparkles } from 'lucide-react';
import {
  CelebrationSoundPrefs,
  getCelebrationSoundPrefs,
  playCelebrationSound,
  setCelebrationSoundEnabled,
  setCelebrationSoundVolume,
  subscribeCelebrationSoundPrefs,
} from '../services/celebrationService';

interface CelebrationSoundControlProps {
  /** Compact variant blends cleanly into storefront navbar or portal headers */
  variant?: 'navbar' | 'portal';
}

export const CelebrationSoundControl: React.FC<CelebrationSoundControlProps> = ({
  variant = 'navbar',
}) => {
  const [prefs, setPrefs] = useState<CelebrationSoundPrefs>(() => getCelebrationSoundPrefs());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return subscribeCelebrationSoundPrefs(setPrefs);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleToggleSound = () => {
    const next = setCelebrationSoundEnabled(!prefs.enabled);
    if (next.enabled) {
      playCelebrationSound('chime');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) / 100;
    setCelebrationSoundVolume(val);
    if (!prefs.enabled && val > 0) {
      setCelebrationSoundEnabled(true);
    }
  };

  const volumePercent = Math.round(prefs.volume * 100);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={
          prefs.enabled
            ? `Celebration sound effects on (${volumePercent}% volume). Open sound settings.`
            : 'Celebration sound effects muted. Open sound settings.'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        title={prefs.enabled ? `Celebration Sound: On (${volumePercent}%)` : 'Celebration Sound: Off'}
        className={
          variant === 'portal'
            ? 'relative inline-flex items-center justify-center min-w-[38px] min-h-[38px] px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B1530] transition-colors cursor-pointer'
            : 'relative flex items-center justify-center w-9 h-9 xs:w-10 xs:h-10 rounded-xl hover:bg-zinc-100 transition-colors text-zinc-700 hover:text-[#0B0B0D] cursor-pointer'
        }
      >
        {prefs.enabled && prefs.volume > 0 ? (
          <Volume2 className="w-[18px] h-[18px] text-[#071B35]" />
        ) : (
          <VolumeX className="w-[18px] h-[18px] text-zinc-400" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Celebration sound settings"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-[#071B35]/15 p-4 z-50 space-y-3.5 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-display font-bold text-[#071B35]">
                Celebration Sound
              </div>
              <div className="text-[11px] text-slate-500">
                Subtle chimes on completed actions
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={prefs.enabled}
              aria-label="Toggle celebration sound effects"
              onClick={handleToggleSound}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] ${
                prefs.enabled ? 'bg-[#FF7A00]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  prefs.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px]">
              <label htmlFor={`celebration-vol-${variant}`} className="font-medium text-slate-600">
                Volume
              </label>
              <span className="font-mono font-semibold text-[#071B35] tabular-nums">
                {prefs.enabled ? `${volumePercent}%` : 'Muted'}
              </span>
            </div>

            <input
              id={`celebration-vol-${variant}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={prefs.enabled ? volumePercent : 0}
              onChange={handleVolumeChange}
              aria-label="Celebration sound volume"
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#FF7A00] bg-slate-200"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400">Saved on this device</span>
            <button
              type="button"
              disabled={!prefs.enabled || prefs.volume <= 0}
              onClick={() => playCelebrationSound('celebration')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#071B35] hover:bg-[#0F2A52] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-[#F6D365]" />
              <span>Preview Chime</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
