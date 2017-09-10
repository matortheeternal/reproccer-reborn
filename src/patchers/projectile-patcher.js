export default class ProjectilePatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchProjectiles) {
      return false;
    }

    return {
      signature: 'AMMO',
      filter: () => true
    }
  }

  patch(record, settings, locals) {
    console.log(`Patching ${xelib.LongName(record)}`);
  }
}
