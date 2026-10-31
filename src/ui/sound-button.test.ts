import { describe, expect, it } from 'vitest';

import { hitSoundButton, nextVolume, volumeLabel, VOLUME_STEPS, SOUND_BUTTON } from './sound-button';

describe('sound button', () => {
  it('hit-tests its own box only', () => {
    const { x, y, w, h } = SOUND_BUTTON;
    expect(hitSoundButton(x + 1, y + 1)).toBe(true);
    expect(hitSoundButton(x + w - 1, y + h - 1)).toBe(true);
    expect(hitSoundButton(x - 1, y + 1)).toBe(false);
    expect(hitSoundButton(x + 1, y - 1)).toBe(false);
    expect(hitSoundButton(320, 200)).toBe(false);
  });

  it('cycles every level and returns to full', () => {
    let volume = 1;
    const seen = [volume];
    for (let i = 0; i < VOLUME_STEPS.length; i++) {
      volume = nextVolume(volume);
      seen.push(volume);
    }
    expect(seen).toEqual([1, 0.6, 0.3, 0, 1]);
  });

  it('restarts at full from an unknown level', () => {
    expect(nextVolume(0.5)).toBe(1);
  });

  it('labels the levels', () => {
    expect(volumeLabel(1)).toBe('100%');
    expect(volumeLabel(0.6)).toBe('60%');
    expect(volumeLabel(0.3)).toBe('30%');
    expect(volumeLabel(0)).toBe('MUTED');
  });
});
