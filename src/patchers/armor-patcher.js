export default class ArmorPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchArmor) {
      return false;
    }

    this.patch = locals.patch;
    this.armor = locals.rules.armor;

    this.updateGameSettings();

    return {
      signature: 'ARMO',
      filter: (armor) => { return true; }

        return true;
      }
    }
  }
}
