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
 * (public/sprites/muncher, kept out of the repo) is present, the Muncher is
 * drawn from the 1990 frames: the 7-frame munch cycle and the frame-4 rest
 * pose, exactly as the original code drives them.
 */
export interface Sprites {
  muncher: HTMLImageElement;
  muncherHappy: HTMLImageElement;
  muncherSad: HTMLImageElement;
  opening: HTMLImageElement;
  troggles: Record<TroggleSpecies, HTMLImageElement>;
  /** 1990 munch frames from the optional pack; empty when absent. */
  muncherFrames: HTMLImageElement[];
  /** Closed-mouth pose from the pack; null when absent. */
  muncherRest: HTMLImageElement | null;
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
  rest?: unknown;
  munch?: unknown;
}

/** Plain relative file names only; never paths or URLs from the manifest. */
function frameNames(manifest: FrameManifest): string[] {
  if (!Array.isArray(manifest.frames)) return [];
  return manifest.frames.filter(
    (name): name is string => typeof name === 'string' && /^[\w-]+\.png$/.test(name),
  );
}

/**
 * The manifest lists the sheet's frame table in blit order plus the roles the
 * original code uses: `munch` (frame indices for the munch cycle, 0..6) and
 * `rest` (the standing/walking pose, frame 4).
 */
async function loadMuncherPack(): Promise<{ frames: HTMLImageElement[]; rest: HTMLImageElement | null }> {
  try {
    const response = await fetch('./sprites/muncher/manifest.json', { cache: 'no-store' });
    if (!response.ok) return { frames: [], rest: null };
    const manifest = await response.json();
    const names = frameNames(manifest);
    if (names.length === 0) return { frames: [], rest: null };
    const loaded = await Promise.all(
      names.map((name) => load(`./sprites/muncher/${name}`).catch(() => null)),
    );
    const table = loaded.filter((image): image is HTMLImageElement => image !== null);
    if (table.length === 0) return { frames: [], rest: null };

    const munchIndices: number[] = Array.isArray(manifest.munch)
      ? manifest.munch.filter(
          (value: unknown): value is number =>
            Number.isInteger(value) && (value as number) >= 0 && (value as number) < table.length,
        )
      : [];
    const frames = munchIndices.length > 0 ? munchIndices.map((i: number) => table[i]!) : table;

    const restIndex =
      Number.isInteger(manifest.rest) && (manifest.rest as number) >= 0 && (manifest.rest as number) < table.length
        ? (manifest.rest as number)
        : -1;
    const rest = restIndex >= 0 ? table[restIndex]! : null;
    return { frames, rest };
  } catch {
    // No pack (the public build): the static Muncher is used instead.
    return { frames: [], rest: null };
  }
}

export async function loadSprites(): Promise<Sprites> {
  const [muncher, muncherHappy, muncherSad, opening, reggie, worker, smarty, bashful, helper, pack] =
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
      loadMuncherPack(),
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
    muncherFrames: pack.frames,
    muncherRest: pack.rest,
  };
}
