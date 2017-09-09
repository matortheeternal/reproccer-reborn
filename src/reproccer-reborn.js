import WeaponPatcher from './patchers/weapon-patcher';
import ArmorPatcher from './patchers/armor-patcher';
import AlchemyPatcher from './patchers/alchemy-patcher';
import ProjectilePatcher from './patchers/projectile-patcher';
import settings from './settings/settings';

export default class ReproccerReborn {
  constructor(info, xelib) {
    this.info = info;
    this.xelib = xelib;
    this.gameModes = [xelib.gmTES5, xelib.gmSSE];
    this.settings = settings;

    this.execute = {
      initialize: this.initialize.bind(this),

      process: [
        new WeaponPatcher(xelib),
        new ArmorPatcher(xelib),
        new AlchemyPatcher(xelib),
        new ProjectilePatcher(xelib)
      ],

      finalize: this.finalize.bind(this)
    };
  }

  initialize(patch, helpers, settings, locals) {

  }

  finalize(patch, helpers, settings, locals) {

  }
}
