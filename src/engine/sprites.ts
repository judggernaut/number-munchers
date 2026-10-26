import muncherUrl from '../assets/muncher.png';
import muncherHappyUrl from '../assets/muncher-happy.png';
import muncherSadUrl from '../assets/muncher-sad.png';
import openingUrl from '../assets/opening.png';
import bashfulUrl from '../assets/troggle-bashful.png';
import helperUrl from '../assets/troggle-helper.png';
import reggieUrl from '../assets/troggle-reggie.png';
import smartyUrl from '../assets/troggle-smarty.png';
import workerUrl from '../assets/troggle-worker.png';

import type { TroggleSpecies } from '../game/troggle';

export interface Sprites {
  muncher: HTMLImageElement;
  muncherHappy: HTMLImageElement;
  muncherSad: HTMLImageElement;
  opening: HTMLImageElement;
  troggles: Record<TroggleSpecies, HTMLImageElement>;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

export async function loadSprites(): Promise<Sprites> {
  const [muncher, muncherHappy, muncherSad, opening, reggie, worker, smarty, bashful, helper] =
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
    ]);
  return {
    muncher,
    muncherHappy,
    muncherSad,
    opening,
    troggles: { reggie, worker, smarty, bashful, helper },
  };
}
