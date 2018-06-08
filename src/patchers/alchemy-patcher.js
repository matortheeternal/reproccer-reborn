import { clamp, safeHasFlag } from './helpers';

export default class AlchemyPatcher {
  constructor(helpers, locals, patch, settings) {
    this.baseStats = settings.alchemy.baseStats;
    this.helpers = helpers;
    this.locals = locals;
    this.rules = locals.rules.alchemy;
    this.settings = settings;
  }

  load = {
    filter: record => {
      if (!this.settings.alchemy.enabled) {
        return false;
      }

      return true;
    },

    signature: 'INGR'
  };

  patch = record => {
    this.updateEffects(record);
    this.clampValue(record);
  };

  updateEffects(record) {
    xelib.GetElements(record, 'Effects').forEach(this.updateEffect);
  }

  updateEffect = effectsHandle => {
    const mgefHandle = xelib.GetWinningOverride(xelib.GetLinksTo(effectsHandle, 'EFID'));
    const name = xelib.FullName(mgefHandle);

    if (this.rules.excludedEffects.includes(name)) {
      return;
    }

    let newDuration = xelib.GetIntValue(effectsHandle, 'EFIT\\Duration');
    let newMagnitude = xelib.GetFloatValue(effectsHandle, 'EFIT\\Magnitude');

    this.rules.effects.some(effect => {
      if (!name.includes(effect.name)) {
        return false;
      }

      newDuration = this.baseStats.duration + effect.bonus;
      newMagnitude *= effect.magnitudeFactor;

      return true;
    });

    if (safeHasFlag(mgefHandle, 'Magic Effect Data\\DATA\\Flags', 'No Duration')) {
      xelib.SetUIntValue(effectsHandle, 'EFIT\\Duration', newDuration);
    }

    if (safeHasFlag(mgefHandle, 'Magic Effect Data\\DATA\\Flags', 'No Magnitude')) {
      newMagnitude = Math.max(1.0, newMagnitude);
      xelib.SetFloatValue(effectsHandle, 'EFIT\\Magnitude', newMagnitude);
    }
  };

  clampValue(record) {
    if (!this.baseStats.usePriceLimits) {
      return;
    }

    const newValue = clamp(
      this.baseStats.priceLimits.lower,
      xelib.GetValue(record, 'DATA\\Value'),
      this.baseStats.priceLimits.upper
    );

    xelib.SetFlag(record, 'ENIT\\Flags', 'No auto-calculation', true);
    xelib.SetUIntValue(record, 'DATA\\Value', newValue);
  }
}

export const defaultSettings = {
  baseStats: {
    duration: 2,
    priceLimits: {
      lower: 5,
      upper: 150
    },
    usePriceLimits: true
  },
  enabled: true
};
