import WeaponPatcher from './patchers/weapon-patcher';
import ArmorPatcher from './patchers/armor-patcher';
import AlchemyPatcher from './patchers/alchemy-patcher';
import ProjectilePatcher from './patchers/projectile-patcher';
import settings from './settings/settings';

export default class ReproccerReborn {
  constructor(fh, info, xelib) {
    this.fh = fh;
    this.info = info;
    this.xelib = xelib;
    this.gameModes = [xelib.gmTES5, xelib.gmSSE];
    this.settings = settings;

    this.execute = {
      initialize: this.initialize.bind(this),

      process: [
        // new WeaponPatcher(xelib),
        // new ArmorPatcher(xelib),
        new AlchemyPatcher(xelib)
        // new ProjectilePatcher(xelib)
      ],

      finalize: this.finalize.bind(this)
    };
  }

  initialize(patch, helpers, settings, locals) {
    this.start = new Date();
    this.buildRules(locals);
    console.log(`started patching: ${this.start}`);
  }

  finalize(patch, helpers, settings, locals) {
    const end = new Date();
    console.log('finished patching: ${end}');
    console.log(Math.abs(this.start - end) / 1000 + 's');
  }

  buildRules(locals) {
    const rules = {};

    this.xelib.GetLoadedFileNames().forEach((plugin) => {
      const data = fh.loadJsonFile(`modules/reproccer-reborn/data/${plugin.slice(0, -4)}.json`, null);
      Object.deepAssign(rules, data);
    });

    locals.rules = rules;
  }
}
