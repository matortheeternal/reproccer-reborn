export default class ArmorPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchArmor) {
      return false;
    }

    return {
      signature: 'ARMO',
      filter: () => true
    }
  }

  patch(record, settings, locals) {
    console.log(`Patching ${xelib.LongName(record)}`);
  }
}