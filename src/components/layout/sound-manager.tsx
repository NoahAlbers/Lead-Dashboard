"use client";

import { createContext, useContext, useCallback, useRef, useEffect, useState, type ReactNode } from "react";

interface SoundContextValue {
  playSound: (priority: "high" | "normal" | "low" | "chime") => void;
  setSoundsEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  soundsEnabled: boolean;
  volume: number;
}

const SoundContext = createContext<SoundContextValue>({
  playSound: () => {},
  setSoundsEnabled: () => {},
  setVolume: () => {},
  soundsEnabled: true,
  volume: 70,
});

export function useSoundManager() {
  return useContext(SoundContext);
}

const SOUND_FILES: Record<string, string> = {
  high: "/sounds/notification-high.mp3",
  normal: "/sounds/notification-normal.mp3",
  low: "/sounds/notification-low.mp3",
  chime: "/sounds/notification-chime.mp3",
};

const STORAGE_KEY = "sound-preferences";

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [volume, setVolume] = useState(70);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const hasInteracted = useRef(false);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.soundsEnabled === "boolean") setSoundsEnabled(parsed.soundsEnabled);
        if (typeof parsed.volume === "number") setVolume(parsed.volume);
      }
    } catch { /* ignore */ }

    // Track user interaction for autoplay policy
    function onInteract() { hasInteracted.current = true; }
    document.addEventListener("click", onInteract, { once: true });
    document.addEventListener("keydown", onInteract, { once: true });
    return () => {
      document.removeEventListener("click", onInteract);
      document.removeEventListener("keydown", onInteract);
    };
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ soundsEnabled, volume }));
  }, [soundsEnabled, volume]);

  // Preload audio files
  useEffect(() => {
    for (const [key, src] of Object.entries(SOUND_FILES)) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audioRefs.current[key] = audio;
    }
  }, []);

  const playSound = useCallback((priority: "high" | "normal" | "low" | "chime") => {
    if (!soundsEnabled || !hasInteracted.current) return;
    const audio = audioRefs.current[priority];
    if (!audio) return;
    audio.volume = volume / 100;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [soundsEnabled, volume]);

  return (
    <SoundContext.Provider value={{ playSound, setSoundsEnabled, setVolume, soundsEnabled, volume }}>
      {children}
    </SoundContext.Provider>
  );
}
