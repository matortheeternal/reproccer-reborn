export default class AlchemyPatcher {
  constructor(xelib) {
    this.xelib = xelib;
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchAlchemyIngredients) {
      return false;
    }

    return {
      signature: 'INGR',
      filter: () => true
    }
  }

  patch(record, settings, locals) {
    console.log(`Patching ${this.xelib.LongName(record)}`);
  }
};
