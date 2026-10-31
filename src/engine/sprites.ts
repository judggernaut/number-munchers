import muncherHappyUrl from '../assets/muncher-happy.png';
import muncherSadUrl from '../assets/muncher-sad.png';
import muncherUrl from '../assets/muncher.png';
import openingUrl from '../assets/opening.png';
import bashfulUrl from '../assets/troggle-bashful.png';
import helperUrl from '../assets/troggle-helper.png';
import reggieUrl from '../assets/troggle-reggie.png';
import smartyUrl from '../assets/troggle-smarty.png';
import workerUrl from '../assets/troggle-worker.png';

import type { TroggleSpecies } from '../game/troggle';

/**
 * The bundled Muncher/Troggle art is the Apache-licensed set carried over from
 * the upstream fork. When the optional original-art pack
 * (public/sprites/muncher, kept out of the repo) is present, its frames
 * replace the static Muncher image so the mouth really animates.
 */
export interface Sprites {
  muncher: HTMLImageElement;
  muncherHappy: HTMLImageElement;
  muncherSad: HTMLImageElement;
  opening: HTMLImageElement;
  troggles: Record<TroggleSpecies, HTMLImageElement>;
  /** 1990 animation frames from the optional pack; empty when absent. */
  muncherFrames: HTMLImageElement[];
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

interface FrameManifest {
  frames?: unknown;
}

/** Plain relative file names only; never paths or URLs from the manifest. */
function frameNames(manifest: FrameManifest): string[] {
  if (!Array.isArray(manifest.frames)) return [];
  return manifest.frames.filter(
    (name): name is string => typeof name === 'string' && /^[\w-]+\.png$/.test(name),
  );
}

async function loadMuncherFrames(): Promise<HTMLImageElement[]> {
  try {
    const response = await fetch('./sprites/muncher/manifest.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const names = frameNames(await response.json());
    if (names.length === 0) return [];
    return await Promise.all(names.map((name) => load(`./sprites/muncher/${name}`)));
  } catch {
    // No pack (the public build): the static Muncher is used instead.
    return [];
  }
}

export async function loadSprites(): Promise<Sprites> {
  const [muncher, muncherHappy, muncherSad, opening, reggie, worker, smarty, bashful, helper, frames] =
    await Promise.all([
      load(muncherUrl),
      load(muncherHappyUrl),
      load(muncherSadUrl),
      load(openingUrl),
      load(reggieUrl),
      load(workerUrl),
      load(smartyUrl),
      load(bashfulUrl),
      load(helperUrl),
      loadMuncherFrames(),
    ]);
  return {
    muncher,
    muncherHappy,
    muncherSad,
    opening,
    troggles: {
      normalus: reggie,
      laborus: worker,
      smarticus: smarty,
      timidus: bashful,
      assistus: helper,
    },
    muncherFrames: frames,
  };
}
