export default class AlchemyPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    this.alchemy = locals.rules.alchemy;

    if (!settings.patchAlchemyIngredients) {
      return false;
    }

    return {
      signature: 'INGR'
    }
  }

  patch(ingredient, settings, locals) {
    this.updateEffects(ingredient);
    this.clampValue(ingredient);
  }

  updateEffects(ingredient) {
    xelib.GetElements(ingredient, 'Effects').forEach(this.updateEffect.bind(this));
  }

  updateEffect(effect) {
    const mgef = xelib.GetLinksTo(effect, 'EFID');
    const name = xelib.FullName(mgef);

    if (this.alchemy.excluded_effects.includes(name)) {
      return;
    }

    let newDuration = xelib.GetValue(effect, 'EFIT\\Duration');
    let newMagnitude = xelib.GetValue(effect, 'EFIT\\Magnitude');

    this.alchemy.base_stats.effects.forEach((e) => {
      if (!name.includes(e.name)) {
        return;
      }

      newDuration = this.alchemy.base_stats.iDurationBase + e.iDurationBonus;
      newMagnitude *= e.fMagnitudeFactor;
    });

    if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Duration')) {
      xelib.SetValue(effect, 'EFIT\\Duration', `${newDuration}`);
    }

    if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Magnitude')) {
      newMagnitude = Math.max(1.0, newMagnitude);
      xelib.SetValue(effect, 'EFIT\\Magnitude', `${newMagnitude}`);
    }
  }

  clampValue(ingredient) {
    if (!this.alchemy.base_stats.bUsePriceLimits) {
      return;
    }

    const min = this.alchemy.base_stats.priceLimitLower;
    const max = this.alchemy.base_stats.priceLimitUpper;
    const originalValue = xelib.GetValue(ingredient, 'DATA\\Value');
    const newValue = Math.min(Math.max(originalValue, min), max);

    xelib.SetFlag(ingredient, 'ENIT\\Flags', 'No auto-calculation', true);
    xelib.SetValue(ingredient, 'DATA\\Value', `${newValue}`);
  }
};
