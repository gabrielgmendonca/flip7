import { useCallback, useEffect, useRef } from 'react';

export type SoundName = 'draw' | 'bust' | 'pass' | 'win' | 'turn';

const SOUND_URLS: Record<SoundName, string> = {
  draw: '/sounds/draw.mp3',
  bust: '/sounds/bust.mp3',
  pass: '/sounds/pass.mp3',
  win: '/sounds/win.mp3',
  turn: '/sounds/turn.mp3',
};

export function useSound(soundEnabled: boolean) {
  const audioCache = useRef<Map<SoundName, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Preload all audio files
    Object.entries(SOUND_URLS).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audioCache.current.set(name as SoundName, audio);
    });

    return () => {
      audioCache.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioCache.current.clear();
    };
  }, []);

  const playSound = useCallback((name: SoundName) => {
    if (!soundEnabled) return;

    const audio = audioCache.current.get(name);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay policy errors
      });
    }
  }, [soundEnabled]);

  return { playSound };
}
