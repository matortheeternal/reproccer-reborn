class AlchemyPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchAlchemyIngredients) {
      return false;
    }

    return {
      signature: 'INGR'
    }
  }

  patch(ingredient, settings, locals) {
    this.alchemy = locals.rules.alchemy;
    this.updateEffects(ingredient);
    this.clampValue(ingredient);
  }

  updateEffects(ingredient) {
    xelib.GetElements(ingredient, 'Effects').forEach(this.updateEffect.bind(this));
  }

  updateEffect(effect) {
    const mgef = xelib.GetLinksTo(effect, 'EFID');
    const name = xelib.GetValue(mgef, 'FULL');

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
}

var html = "\n<h2>Reproccer Reborn</h2>\n<p>Compatibility patch and weapon/armor/alchemy/projectile stat overhaul creator for T3nd0's Skyrim Redone</p>\n<p>\n   Use the below settings to determine which type of records to patch. <br>\n  Use the data files to tweak the stats of the patched item sto your liking. <br>\n  Remember to re-run the patcher anytime that you change your load order!!\n</p>\n<section>\n  <ignore-plugins patcher-id=\"reproccerReborn\"></ignore-plugins>\n</section>\n<section>\n  <div><span class=\"input-label\">Patch Weapons</span>\n    <input type=\"checkbox\" ng-model=\"settings.reproccerReborn.patchWeapons\">\n    <ul>\n      <li>Adjusts weapon stats as specified by Stats.json</li>\n      <li>Generates meltdown recipes and modifies tempering recipes.</li>\n      <li>Generates Refined Silver variants of silver weapons.</li>\n      <li>Generates crossbow variants of all crossbows.</li>\n      <li>Links mod-added weapons to Skyrim Redone's perks.</li>\n    </ul>\n  </div>\n  <div><span class=\"input-label\">Patch Armor</span>\n    <input type=\"checkbox\" ng-model=\"settings.reproccerReborn.patchArmor\">\n    <ul>\n      <li>Adjusts armor stats as specified by Stats.json.</li>\n      <li>Generates meltdown recipes and modifies tempering recipes</li>\n      <li>Sets armor cap and armor protection per value. </li>\n      <li>Generates dreamcloth variants of regular clothing pieces.</li>\n    </ul>\n  </div>\n  <div><span class=\"input-label\">Patch Alchemy Ingredients</span>\n    <input type=\"checkbox\" ng-model=\"settings.reproccerReborn.patchAlchemyIngredients\">\n    <ul>\n      <li>Adjusts alchemy ingredients to work over time.</li>\n      <li>Optionally enforces upper and lower price limits for ingredients.</li>\n    </ul>\n  </div>\n  <div><span class=\"input-label\">Patch Projectiles</span>\n    <input type=\"checkbox\" ng-model=\"settings.reproccerReborn.patchProjectiles\">\n    <ul>\n      <li>Adjusts both arrow and bolt speed, gravity influence, reach, and damage. </li>\n      <li>Creates explosive, timebomb, barbed, elemental, strong and stronger variants if applicable.</li>\n    </ul>\n  </div>\n</section>";

var settings = {
  label: 'Reproccer Reborn',
  template: html,
  templateUrl: '../modules/reproccer-reborn/settings.html',
  patchFileName: 'ReProccer.esp',

  defaultSettings: {
    patchWeapons: true,
    patchArmor: true,
    patchAlchemyIngredients: true,
    patchProjectiles: true,

    requiredFiles: [
      'SkyRe_Main.esp'
    ],

    ignoredFiles: [
      'The Huntsman.esp',
      'Apocalypse - The Spell Package.esp',
      'Lilarcor.esp',
      'NPO Module - Crossbows.esp',
      'Post Reproccer Scoped Bows Patch.esp',
      'brokenmod.esp',
      'Bashed Patch, 0.esp',
      'Chesko_WearableLantern.esp',
      'Chesko_WearableLantern_Guards.esp',
      'Chesko_WearableLantern_Caravaner.esp',
      'Chesko_WearableLantern_Candle.esp',
      'Chesko_WearableLantern_Candle_DG.esp',
      'EMCompViljaSkyrim.esp',
      'Outfitmerge.esp',
      'ReProccerNONPLAYERfix.esp',
      'WICskyreFix.esp',
      'Dr_Bandolier.esp',
      'Dr_BandolierDG.esp',
      'BandolierForNPCsCheaperBandoliers.esp',
      'BandolierForNPCsCheaperBandoliers_BalancedWeight.esp',
      'BandolierForNPCsCheaperBandoliersDawnguard.esp',
      'BandolierForNPCsCheaperBandoliers_BalancedWeight_Dawnguard.esp',
      'dwarvenrifle.esp',
      'j3x-autocrossbows.esp',
      'dwavenautorifle1.esp',
      'Post ReProccer Fixes CCOR IA7 aMidianSS Content Addon Patch.esp',
      'Post ReProccer Fixes CCOR IA7 aMidianSS Patch.esp',
      'Post ReProccer Fixes CCOR IA7 IW aMidianSS Content Addon Patch.esp',
      'Post ReProccer Fixes CCOR IA7 IW aMidianSS Patch.esp',
      'Post ReProccer Fixes CCOR IA7 IW Patch.esp',
      'Post ReProccer Fixes CCOR IA7 IW Patch(Personal).esp',
      'Post ReProccer Fixes CCOR IA7 IW UU aMidianSS Content Addon Patch.esp',
      'Post ReProccer Fixes CCOR IA7 IW UU aMidianSS Patch.esp',
      'Post ReProccer Fixes CCOR IA7 IW UU Patch.esp',
      'Post ReProccer Fixes CCOR IA7 UU aMidianSS Content Addon Patch.esp',
      'Post ReProccer Fixes CCOR IA7 UU aMidianSS Patch.esp',
      'Post ReProccer Fixes CCOR IA7 UU Patch.esp',
      'Post ReProccer Fixes IA7 aMidianSS Content AddonPatch.esp',
      'Post ReProccer Fixes IA7 aMidianSS Patch.esp',
      'Post ReProccer Fixes IA7 IW aMidianSS Content AddonPatch.esp',
      'Post ReProccer Fixes IA7 IW aMidianSS Patch.esp',
      'Post ReProccer Fixes IA7 IW Patch.esp',
      'Post ReProccer Fixes IA7 IW UU aMidianSS Content Addon Patch.esp',
      'Post ReProccer Fixes IA7 IW UU aMidianSS Patch.esp',
      'Post ReProccer Fixes IA7 IW UU Patch.esp',
      'Post ReProccer Fixes IA7 Patch.esp',
      'Post ReProccer Fixes IA7 UU aMidianSS Content Addon Patch.esp',
      'Post ReProccer Fixes IA7 UU aMidianSS Patch.esp',
      'Post ReProccer Fixes IA7 UU Patch.esp'
    ]
  }
};

class ReproccerReborn {
  constructor(fh, info) {
    this.fh = fh;
    this.info = info;
    this.gameModes = [xelib.gmTES5, xelib.gmSSE];
    this.settings = settings;

    this.execute = {
      initialize: this.initialize.bind(this),

      process: [
        // new WeaponPatcher(),
        // new ArmorPatcher(),
        new AlchemyPatcher()
        // new ProjectilePatcher()
      ],

      finalize: this.finalize.bind(this)
    };
  }

  initialize(patch, helpers, settings$$1, locals) {
    this.start = new Date();
    this.buildRules(locals);
    console.log(`started patching: ${this.start}`);
  }

  finalize(patch, helpers, settings$$1, locals) {
    const end = new Date();
    console.log(`finished patching: ${end}`);
    console.log(Math.abs(this.start - end) / 1000 + 's');
  }

  buildRules(locals) {
    const rules = {};

    xelib.GetLoadedFileNames().forEach((plugin) => {
      const data = fh.loadJsonFile(`modules/reproccer-reborn/data/${plugin.slice(0, -4)}.json`, null);
      Object.deepAssign(rules, data);
    });

    locals.rules = rules;
  }
}

ngapp.run((patcherService) => {
  patcherService.registerPatcher(new ReproccerReborn(fh, info));
});
