export default class AlchemyPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
    this.updateEffect = this.updateEffect.bind(this);
  }

  // eslint-disable-next-line no-unused-vars
  load(plugin, helpers, settings, locals) {
    this.alchemy = locals.rules.alchemy;
    this.settings = settings;

    if (!settings.patchAlchemyIngredients) {
      return false;
    }

    return {
      signature: 'INGR'
    };
  }

  // eslint-disable-next-line no-unused-vars
  patch(ingredient, helpers, settings, locals) {
    this.updateEffects(ingredient);
    this.clampValue(ingredient);
  }

  updateEffects(ingredient) {
    xelib.GetElements(ingredient, 'Effects').forEach(this.updateEffect);
  }

  updateEffect(effect) {
    const mgef = xelib.GetWinningOverride(xelib.GetLinksTo(effect, 'EFID'));
    const name = xelib.FullName(mgef);

    if (this.alchemy.excludedEffects.includes(name)) {
      return;
    }

    let newDuration = xelib.GetIntValue(effect, 'EFIT\\Duration');
    let newMagnitude = xelib.GetFloatValue(effect, 'EFIT\\Magnitude');

    this.alchemy.baseStats.effects.some(e => {
      if (!name.includes(e.name)) {
        return false;
      }

      newDuration = this.settings.alchemyBaseStats.durationBase + e.durationBonus;
      newMagnitude *= e.magnitudeFactor;

      return true;
    });

    if (
      xelib.HasElement(mgef, 'Magic Effect Data') &&
      !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Duration')
    ) {
      xelib.SetUIntValue(effect, 'EFIT\\Duration', newDuration);
    }

    if (
      xelib.HasElement(mgef, 'Magic Effect Data') &&
      !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Magnitude')
    ) {
      newMagnitude = Math.max(1.0, newMagnitude);
      xelib.SetFloatValue(effect, 'EFIT\\Magnitude', newMagnitude);
    }
  }

  clampValue(ingredient) {
    if (!this.settings.alchemyBaseStats.usePriceLimits) {
      return;
    }

    const min = this.settings.alchemyBaseStats.priceLimitLower;
    const max = this.settings.alchemyBaseStats.priceLimitUpper;
    const originalValue = xelib.GetValue(ingredient, 'DATA\\Value');
    const newValue = Math.min(Math.max(originalValue, min), max);

    xelib.SetFlag(ingredient, 'ENIT\\Flags', 'No auto-calculation', true);
    xelib.SetUIntValue(ingredient, 'DATA\\Value', newValue);
  }
}
