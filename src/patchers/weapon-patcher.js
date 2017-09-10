export default class WeaponPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchWeapons) {
      return false;
    }

    return {
      signature: 'WEAP',
      filter: () => true
    }
  }

  patch(record, settings, locals) {
    console.log(`Patching ${xelib.LongName(record)}`);
  }
}
