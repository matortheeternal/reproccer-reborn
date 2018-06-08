import AlchemyPatcher from './patchers/alchemy-patcher';
import ArmorPatcher from './patchers/armor-patcher';
import ProjectilePatcher from './patchers/projectile-patcher';
import WeaponPatcher from './patchers/weapon-patcher';
import Settings from './settings/settings';

export default class ReproccerReborn {
  constructor(fh, info) {
    this.fh = fh;
    this.info = info;
    this.gameModes = [xelib.gmTES5, xelib.gmSSE];
    this.requiredFiles = Settings.requiredFiles;
    this.settings = Settings;

    this.execute = {
      initialize: this.initialize,

      process: [
        new AlchemyPatcher(),
        new ArmorPatcher(),
        new ProjectilePatcher(),
        new WeaponPatcher()
      ],

      finalize: this.finalize
    };
  }

  getFilesToPatch(filenames) {
    return filenames.subtract(['ReProccer.esp']);
  }

  // eslint-disable-next-line no-unused-vars
  initialize = (patch, helpers, settings, locals) => {
    this.start = new Date();
    console.log(`started patching: ${this.start}`);

    locals.patch = patch;
    this.buildRules(locals);
    this.loadStatics(locals);
    locals.cobj = helpers.loadRecords('COBJ').map(handle => ({
      handle: xelib.GetWinningOverride(handle),
      cnam: xelib.GetUIntValue(handle, 'CNAM'),
      bnam: xelib.GetUIntValue(handle, 'BNAM')
    }));
  };

  // eslint-disable-next-line no-unused-vars
  loadStatics(locals) {
    const files = {};
    const loadOrders = {};

    function getFile(filename) {
      if (!files[filename]) {
        files[filename] = xelib.FileByName(filename);
      }

      return files[filename];
    }

    function getLoadOrder(file) {
      if (!loadOrders[file]) {
        loadOrders[file] = xelib.GetFileLoadOrder(file);
      }

      return loadOrders[file];
    }

    function GetHex(formId, filename) {
      const loadOrder = getLoadOrder(getFile(filename));
      return xelib.Hex((loadOrder << 24) | formId);
    }

    locals.statics = {
      // Explosions
      expBarbed: GetHex(0x0c3421, 'SkyRe_Main.esp'),
      expElementalFire: GetHex(0x010d90, 'Dawnguard.esm'),
      expElementalFrost: GetHex(0x010d91, 'Dawnguard.esm'),
      expElementalShock: GetHex(0x010d92, 'Dawnguard.esm'),
      expExploding: GetHex(0x00f952, 'SkyRe_Main.esp'),
      expHeavyweight: GetHex(0x3df04c, 'SkyRe_Main.esp'),
      expNoisemaker: GetHex(0x03a323, 'SkyRe_Main.esp'),
      expNeuralgia: GetHex(0x3df04f, 'SkyRe_Main.esp'),
      expTimebomb: GetHex(0x00f944, 'SkyRe_Main.esp'),

      // Game Settings
      gmstfArmorScalingFactor: GetHex(0x021a72, 'Skyrim.esm'),
      gmstfMaxArmorRating: GetHex(0x037deb, 'Skyrim.esm'),

      // Items
      ingotCorundum: GetHex(0x05ad93, 'Skyrim.esm'),
      ingotDwarven: GetHex(0x0db8a2, 'Skyrim.esm'),
      ingotEbony: GetHex(0x05ad9d, 'Skyrim.esm'),
      ingotGold: GetHex(0x05ad9e, 'Skyrim.esm'),
      ingotIron: GetHex(0x05ace4, 'Skyrim.esm'),
      ingotMalachite: GetHex(0x05ada1, 'Skyrim.esm'),
      ingotMoonstone: GetHex(0x05ad9f, 'Skyrim.esm'),
      ingotOrichalcum: GetHex(0x05ad99, 'Skyrim.esm'),
      ingotQuicksilver: GetHex(0x05ada0, 'Skyrim.esm'),
      ingotSilver: GetHex(0x05ace3, 'Skyrim.esm'),
      ingotSteel: GetHex(0x05ace5, 'Skyrim.esm'),

      ale: GetHex(0x034c5e, 'Skyrim.esm'),
      boneMeal: GetHex(0x034cdd, 'Skyrim.esm'),
      charcoal: GetHex(0x033760, 'Skyrim.esm'),
      chaurusChitin: GetHex(0x03ad57, 'Skyrim.esm'),
      deathBell: GetHex(0x0516c8, 'Skyrim.esm'),
      dragonbone: GetHex(0x03ada4, 'Skyrim.esm'),
      dragonscale: GetHex(0x03ada3, 'Skyrim.esm'),
      fireSalt: GetHex(0x03ad5e, 'Skyrim.esm'),
      firewood: GetHex(0x06f993, 'Skyrim.esm'),
      frostSalt: GetHex(0x03ad5f, 'Skyrim.esm'),
      leather: GetHex(0x0db5d2, 'Skyrim.esm'),
      leatherStrips: GetHex(0x0800e4, 'Skyrim.esm'),
      netchLeather: GetHex(0x01cd7c, 'Dragonborn.esm'),
      oreStalhrim: GetHex(0x02b06b, 'Dragonborn.esm'),
      pettySoulGem: GetHex(0x02e4e2, 'Skyrim.esm'),
      torchbugThorax: GetHex(0x04da73, 'Skyrim.esm'),
      voidSalt: GetHex(0x03ad60, 'Skyrim.esm'),

      // Keywords
      kwClothingHands: GetHex(0x10cd13, 'Skyrim.esm'),
      kwClothingHead: GetHex(0x10cd11, 'Skyrim.esm'),
      kwClothingFeet: GetHex(0x10cd12, 'Skyrim.esm'),
      kwClothingBody: GetHex(0x0a8657, 'Skyrim.esm'),
      kwArmorClothing: GetHex(0x06bb8, 'Skyrim.esm'),
      kwArmorHeavy: GetHex(0x06bbd2, 'Skyrim.esm'),
      kwArmorLight: GetHex(0x06bbd3, 'Skyrim.esm'),
      kwArmorDreamcloth: GetHex(0x05c2c4, 'SkyRe_Main.esp'),
      kwArmorMaterialBlades: GetHex(0x008255, 'SkyRe_Main.esp'),
      kwArmorMaterialBonemoldHeavy: GetHex(0x024101, 'Dragonborn.esm'),
      kwArmorMaterialDaedric: GetHex(0x06bbd4, 'Skyrim.esm'),
      kwArmorMaterialDarkBrotherhood: GetHex(0x10fd62, 'Skyrim.esm'),
      kwArmorMaterialDawnguard: GetHex(0x012ccd, 'Dawnguard.esm'),
      kwArmorMaterialDragonplate: GetHex(0x06bbd5, 'Skyrim.esm'),
      kwArmorMaterialDragonscale: GetHex(0x06bbd6, 'Skyrim.esm'),
      kwArmorMaterialDraugr: GetHex(0x008257, 'SkyRe_Main.esp'),
      kwArmorMaterialDwarven: GetHex(0x06bbd7, 'Skyrim.esm'),
      kwArmorMaterialEbony: GetHex(0x06bbd8, 'Skyrim.esm'),
      kwArmorMaterialElven: GetHex(0x06bbd9, 'Skyrim.esm'),
      kwArmorMaterialElvenGilded: GetHex(0x06bbda, 'Skyrim.esm'),
      kwArmorMaterialFalmer: GetHex(0x008258, 'SkyRe_Main.esp'),
      kwArmorMaterialFalmerHardened: GetHex(0x012cce, 'Dawnguard.esm'),
      kwArmorMaterialFalmerHeavy: GetHex(0x012ccf, 'Dawnguard.esm'),
      kwArmorMaterialFalmerHeavyOriginal: GetHex(0x012cd0, 'Dawnguard.esm'),
      kwArmorMaterialFur: GetHex(0x008254, 'SkyRe_Main.esp'),
      kwArmorMaterialGlass: GetHex(0x06bbdc, 'Skyrim.esm'),
      kwArmorMaterialHide: GetHex(0x06bbdd, 'Skyrim.esm'),
      kwArmorMaterialHunter: GetHex(0x0050c4, 'Dawnguard.esm'),
      kwArmorMaterialImperialHeavy: GetHex(0x06bbe2, 'Skyrim.esm'),
      kwArmorMaterialImperialLight: GetHex(0x06bbe0, 'Skyrim.esm'),
      kwArmorMaterialImperialStudded: GetHex(0x06bbe1, 'Skyrim.esm'),
      kwArmorMaterialIron: GetHex(0x06bbe3, 'Skyrim.esm'),
      kwArmorMaterialIronBanded: GetHex(0x06bbe4, 'Skyrim.esm'),
      kwArmorMaterialLeather: GetHex(0x06bbdb, 'Skyrim.esm'),
      kwArmorMaterialNightingale: GetHex(0x10fd61, 'Skyrim.esm'),
      kwArmorMaterialNordicHeavy: GetHex(0x024105, 'Dragonborn.esm'),
      kwArmorMaterialOrcish: GetHex(0x06bbe5, 'Skyrim.esm'),
      kwArmorMaterialScaled: GetHex(0x06bbde, 'Skyrim.esm'),
      kwArmorMaterialStalhrimHeavy: GetHex(0x024106, 'Dragonborn.esm'),
      kwArmorMaterialStalhrimLight: GetHex(0x024107, 'Dragonborn.esm'),
      kwArmorMaterialSteel: GetHex(0x06bbe6, 'Skyrim.esm'),
      kwArmorMaterialSteelPlate: GetHex(0x06bbe7, 'Skyrim.esm'),
      kwArmorMaterialStormcloak: GetHex(0x0ac13a, 'Skyrim.esm'),
      kwArmorMaterialStudded: GetHex(0x06bbdf, 'Skyrim.esm'),
      kwArmorMaterialVampire: GetHex(0x01463e, 'Dawnguard.esm'),
      kwArmorShieldHeavy: GetHex(0x08f265, 'SkyRe_Main.esp'),
      kwArmorShieldLight: GetHex(0x08f266, 'SkyRe_Main.esp'),
      kwArmorSlotGauntlets: GetHex(0x06c0ef, 'Skyrim.esm'),
      kwArmorSlotHelmet: GetHex(0x06c0ee, 'Skyrim.esm'),
      kwArmorSlotBoots: GetHex(0x06c0ed, 'Skyrim.esm'),
      kwArmorSlotCuirass: GetHex(0x06c0ec, 'Skyrim.esm'),
      kwArmorSlotShield: GetHex(0x0965b2, 'Skyrim.esm'),
      kwCraftingSmelter: GetHex(0x00a5cce, 'Skyrim.esm'),
      kwCraftingSmithingArmorTable: GetHex(0x0adb78, 'Skyrim.esm'),
      kwCraftingSmithingForge: GetHex(0x088105, 'Skyrim.esm'),
      kwCraftingSmithingSharpeningWheel: GetHex(0x088108, 'Skyrim.esm'),
      kwCraftingTanningRack: GetHex(0x07866a, 'Skyrim.esm'),
      kwJewelry: GetHex(0x08f95a, 'Skyrim.esm'),
      kwMasqueradeBandit: GetHex(0x03a8aa, 'SkyRe_Main.esp'),
      kwMasqueradeForsworn: GetHex(0x03a8a9, 'SkyRe_Main.esp'),
      kwMasqueradeImperial: GetHex(0x037d31, 'SkyRe_Main.esp'),
      kwMasqueradeStormcloak: GetHex(0x037d2f, 'SkyRe_Main.esp'),
      kwMasqueradeThalmor: GetHex(0x037d2b, 'SkyRe_Main.esp'),
      kwVendorItemClothing: GetHex(0x08f95b, 'Skyrim.esm'),
      kwWeapMaterialDaedric: GetHex(0x01e71f, 'Skyrim.esm'),
      kwWeapMaterialDragonbone: GetHex(0x019822, 'Dawnguard.esm'),
      kwWeapMaterialDraugr: GetHex(0x0c5c01, 'Skyrim.esm'),
      kwWeapMaterialDraugrHoned: GetHex(0x0c5c02, 'Skyrim.esm'),
      kwWeapMaterialDwarven: GetHex(0x01e71a, 'Skyrim.esm'),
      kwWeapMaterialEbony: GetHex(0x01e71e, 'Skyrim.esm'),
      kwWeapMaterialElven: GetHex(0x01e71b, 'Skyrim.esm'),
      kwWeapMaterialFalmer: GetHex(0x0c5c03, 'Skyrim.esm'),
      kwWeapMaterialFalmerHoned: GetHex(0x0c5c04, 'Skyrim.esm'),
      kwWeapMaterialGlass: GetHex(0x01e71d, 'Skyrim.esm'),
      kwWeapMaterialImperial: GetHex(0x0c5c00, 'Skyrim.esm'),
      kwWeapMaterialIron: GetHex(0x01e718, 'Skyrim.esm'),
      kwWeapMaterialNordic: GetHex(0x026230, 'Dragonborn.esm'),
      kwWeapMaterialOrcish: GetHex(0x01e71c, 'Skyrim.esm'),
      kwWeapMaterialSilver: GetHex(0x10aa1a, 'Skyrim.esm'),
      kwWeapMaterialSilverRefined: GetHex(0x24f987, 'SkyRe_Main.esp'),
      kwWeapMaterialStalhrim: GetHex(0x02622f, 'Dragonborn.esm'),
      kwWeapMaterialSteel: GetHex(0x01e719, 'Skyrim.esm'),
      kwWeapMaterialWood: GetHex(0x01e717, 'Skyrim.esm'),
      kwWeapTypeBastardSword: GetHex(0x054ff1, 'SkyRe_Main.esp'),
      kwWeapTypeBattleaxe: GetHex(0x06d932, 'Skyrim.esm'),
      kwWeapTypeBattlestaff: GetHex(0x020857, 'SkyRe_Main.esp'),
      kwWeapTypeBow: GetHex(0x01e715, 'Skyrim.esm'),
      kwWeapTypeBroadsword: GetHex(0x05451f, 'SkyRe_Main.esp'),
      kwWeapTypeClub: GetHex(0x09ba23, 'SkyRe_Main.esp'),
      kwWeapTypeCrossbow: GetHex(0x06f3fd, 'Skyrim.esm'),
      kwWeapTypeDagger: GetHex(0x01e713, 'Skyrim.esm'),
      kwWeapTypeGlaive: GetHex(0x09ba40, 'SkyRe_Main.esp'),
      kwWeapTypeGreatsword: GetHex(0x06d931, 'Skyrim.esm'),
      kwWeapTypeHalberd: GetHex(0x09ba3e, 'SkyRe_Main.esp'),
      kwWeapTypeHatchet: GetHex(0x333676, 'SkyRe_Main.esp'),
      kwWeapTypeKatana: GetHex(0x054523, 'SkyRe_Main.esp'),
      kwWeapTypeLongbow: GetHex(0x06f3fe, 'Skyrim.esm'),
      kwWeapTypeLongmace: GetHex(0x0a068f, 'SkyRe_Main.esp'),
      kwWeapTypeLongsword: GetHex(0x054520, 'SkyRe_Main.esp'),
      kwWeapTypeMace: GetHex(0x01e714, 'Skyrim.esm'),
      kwWeapTypeMaul: GetHex(0x333677, 'SkyRe_Main.esp'),
      kwWeapTypeNodachi: GetHex(0x054a88, 'SkyRe_Main.esp'),
      kwWeapTypeSaber: GetHex(0x054a87, 'SkyRe_Main.esp'),
      kwWeapTypeScimitar: GetHex(0x054a87, 'SkyRe_Main.esp'),
      kwWeapTypeShortbow: GetHex(0x056b5f, 'SkyRe_Main.esp'),
      kwWeapTypeShortspear: GetHex(0x1ac2b9, 'SkyRe_Main.esp'),
      kwWeapTypeShortsword: GetHex(0x085067, 'SkyRe_Main.esp'),
      kwWeapTypeStaff: GetHex(0x01e716, 'Skyrim.esm'),
      kwWeapTypeSword: GetHex(0x01e711, 'Skyrim.esm'),
      kwWeapTypeTanto: GetHex(0x054522, 'SkyRe_Main.esp'),
      kwWeapTypeUnarmed: GetHex(0x066f62, 'SkyRe_Main.esp'),
      kwWeapTypeWakizashi: GetHex(0x054521, 'SkyRe_Main.esp'),
      kwWeapTypeWaraxe: GetHex(0x01e712, 'Skyrim.esm'),
      kwWeapTypeWarhammer: GetHex(0x06d930, 'Skyrim.esm'),
      kwWeapTypeYari: GetHex(0x09ba3f, 'SkyRe_Main.esp'),

      // Lights
      lightLightsource: GetHex(0x03a335, 'SkyRe_Main.esp'),

      // Perks
      perkAlchemyFuse: GetHex(0x00feda, 'SkyRe_Main.esp'),
      perkAlchemyAdvancedExplosives: GetHex(0x00fed9, 'SkyRe_Main.esp'),
      perkDreamclothBody: GetHex(0x5cda5, 'SkyRe_Main.esp'),
      perkDreamclothHands: GetHex(0x5cda8, 'SkyRe_Main.esp'),
      perkDreamclothHead: GetHex(0x5cda4, 'SkyRe_Main.esp'),
      perkDreamclothFeet: GetHex(0x5cda7, 'SkyRe_Main.esp'),
      perkEnchantingElementalBombard0: GetHex(0x0af659, 'SkyRe_Main.esp'),
      perkEnchantingElementalBombard1: GetHex(0x3df04e, 'SkyRe_Main.esp'),
      perkMarksmanshipAdvancedMissilecraft0: GetHex(0x0af670, 'SkyRe_Main.esp'),
      perkMarksmanshipAdvancedMissilecraft1: GetHex(0x0af6a4, 'SkyRe_Main.esp'),
      perkMarksmanshipAdvancedMissilecraft2: GetHex(0x3df04d, 'SkyRe_Main.esp'),
      perkMarksmanshipArbalest: GetHex(0x0af6a1, 'SkyRe_Main.esp'),
      perkMarksmanshipBallistics: GetHex(0x0af657, 'SkyRe_Main.esp'),
      perkMarksmanshipEngineer: GetHex(0x0af6a5, 'SkyRe_Main.esp'),
      perkMarksmanshipLightweightConstruction: GetHex(0x0af6a2, 'SkyRe_Main.esp'),
      perkMarksmanshipRecurve: GetHex(0x0af6a0, 'SkyRe_Main.esp'),
      perkMarksmanshipSilencer: GetHex(0x0af6a3, 'SkyRe_Main.esp'),
      perkSmithingAdvanced: GetHex(0x0cb414, 'Skyrim.esm'),
      perkSmithingArcaneBlacksmith: GetHex(0x05218e, 'Skyrim.esm'),
      perkSmithingDaedric: GetHex(0x0cb413, 'Skyrim.esm'),
      perkSmithingDragon: GetHex(0x052190, 'Skyrim.esm'),
      perkSmithingDwarven: GetHex(0x0cb40e, 'Skyrim.esm'),
      perkSmithingEbony: GetHex(0x0cb412, 'Skyrim.esm'),
      perkSmithingElven: GetHex(0x0cb40f, 'Skyrim.esm'),
      perkSmithingGlass: GetHex(0x0cb411, 'Skyrim.esm'),
      perkSmithingLeather: GetHex(0x1d8be6, 'SkyRe_Main.esp'),
      perkSmithingMeltdown: GetHex(0x058f75, 'Skyrim.esm'),
      perkSmithingOrcish: GetHex(0x0cb410, 'Skyrim.esm'),
      perkSmithingSilver: GetHex(0x0581e2, 'Skyrim.esm'),
      perkSmithingSilverRefined: GetHex(0x054ff5, 'SkyRe_Main.esp'),
      perkSmithingSteel: GetHex(0x0cb40d, 'Skyrim.esm'),
      perkSmithingWeavingMill: GetHex(0x05c827, 'SkyRe_Main.esp'),
      perkSneakThiefsToolbox0: GetHex(0x037d35, 'SkyRe_Main.esp'),
      perkWeaponCrossbow: GetHex(0x252122, 'SkyRe_Main.esp'),
      perkWeaponCrossbowArbalest: GetHex(0x0af6a6, 'SkyRe_Main.esp'),
      perkWeaponCrossbowArbalestSilenced: GetHex(0x0af6a8, 'SkyRe_Main.esp'),
      perkWeaponCrossbowSilenced: GetHex(0x0af6a7, 'SkyRe_Main.esp'),
      perkWeaponShortspear: GetHex(0x1ac2ba, 'SkyRe_Main.esp'),
      perkWeaponSilverRefined: GetHex(0x056b5c, 'SkyRe_Main.esp'),
      perkWeaponYari: GetHex(0x09e623, 'SkyRe_Main.esp')
    };
  }

  // eslint-disable-next-line no-unused-vars
  finalize = (patch, helpers, settings, locals) => {
    const end = new Date();
    console.log(`finished patching: ${end}`);
    console.log(`${Math.abs(this.start - end) / 1000}s`);
  };

  buildRules(locals) {
    const rules = {};

    const first = fh.loadJsonFile(`modules/reproccerReborn/data/first.json`, null);
    Object.deepAssign(rules, first);

    xelib.GetLoadedFileNames().forEach(plugin => {
      const data = fh.loadJsonFile(
        `modules/reproccerReborn/data/${plugin.slice(0, -4)}.json`,
        null
      );

      if (data) {
        Object.deepAssign(rules, data);
      }
    });

    const last = fh.loadJsonFile(`modules/reproccerReborn/data/last.json`, null);
    Object.deepAssign(rules, last);

    locals.rules = rules;
    console.log(locals.rules);
  }
}
