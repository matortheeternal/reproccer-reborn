import * as helpers from './helpers';

export default class WeaponPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patchFile = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    if (!settings.patchWeapons) {
      return false;
    }

    this.settings = settings;
    this.weapons = locals.rules.weapons;
    this.statics = locals.statics;
    this.cobj = locals.cobj;
    this.refinedSilverWeapons = locals.refinedSilverWeapons;

    this.createKeywordMaps();

    return {
      signature: 'WEAP',
      filter: (weapon) => {
        const name = xelib.FullName(weapon);

        if (this.weapons.excluded_weapons.find((e) => name.includes(e))) { return false; }
        if (xelib.HasArrayItem(weapon, 'KWDA', '', 'WeapTypeStaff')) { return false; }
        if (xelib.HasElement(weapon, 'CNAM')) { return true; }
        if (xelib.GetFlag(weapon, 'DATA\\Flags', 'Non-playable')) { return false; }
        if (!name) { return false; }
      }
    }
  }

  patch(weapon, settings, locals) {
    if (xelib.HasElement(weapon, 'CNAM')) {
      this.checkBroadswordName(weapon);
      this.patchBowType(weapon);
      return;
    }

    this.checkOverrides(wepaon);
    this.patchWeaponKeywords(weapon);
    this.patchWeaponDamage(weapon);
    this.patchWeaponReach(weapon);
    this.modifyCrossbowCraftingRecipe(weapon);
    this.processCrossbow(Weapon);
    this.processSilverWeapon(weapon);
    this.addMeltdownRecipe(weapon);
    this.modifyTemperingRecipes(weapon);
  }

  checkBroadswordName(weapon) {
    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeSword)) { return; }
    if (xelib.FullName(weapon).includes('Broadsword')) { return; }

    xelib.AddElementValue(weapon, 'FULL', xelib.FullName(weapon).replace('Sword', 'Broadsword'));
  }

  patchBowType(weapon) {
    const kwda = helpers.getKwda(weapon);
    if (!kwda(this.statics.kwWeapTypeBow) || !kwda(this.statics.kwWeapTypeCrossbow)) { return; }
    if (kwda(this.statics.kwWeapTypeLongbow) || kwda(this.statics.kwWeapTypeShortbow)) { return; }

    const name = xelib.FullName(weapon);
    if (name.includes('Longbow') || name.includes('Shortbow') || name.includes('Crossbow')) { return; }

    xelib.AddElement(weapon, 'KWDA\\.', this.statics.kwWeapTypeShortbow);
    if (name.includes('Bow')) {
      xelib.AddElementValue(weapon, 'FULL', name.replace('Shortbow'));
    } else {
      xelib.AddElementValue(weapon, 'FULL', `${name} [Shortbow]`);
    }
  }

  checkOverrides(weapon) {
    let name = xelib.FullName(weapon);
    const type = this.getWeaponTypeOverride(name);

    if (type) {
      name = `${name} [${type}]`;
      xelib.AddElementValue(weapon, 'FULL', name);
    }

    const override = this.getWeaponMaterialOverrideString(name);
    if (!override) { return; }

    if (this.hasWeaponKeyword(weapon)) { return; }

    const overrideMap = {
      ADVANCED:       { kwda: this.statics.kwWeapMaterialAdvanced,       perk: this.statics.perkSmithingAdvanced },
      DRAGONBONE:     { kwda: this.statics.kwWeapMaterialDragonPlate,    perk: this.statics.perkSmithingDragon   },
      DAEDRIC:        { kwda: this.statics.kwWeapMaterialDaedric,        perk: this.statics.perkSmithingDaedric  },
      DRAUGR:         { kwda: this.statics.kwWeapMaterialDraugr,         perk: this.statics.perkSmithingSteel    },
      DWARVEN:        { kwda: this.statics.kwWeapMaterialDwarven,        perk: this.statics.perkSmithingDwarven  },
      EBONY:          { kwda: this.statics.kwWeapMaterialEbony,          perk: this.statics.perkSmithingEbony    },
      ELVEN:          { kwda: this.statics.kwWeapMaterialElven,          perk: this.statics.perkSmithingElven    },
      FALMER:         { kwda: this.statics.kwWeapMaterialFalmer,         perk: this.statics.perkSmithingAdvanced },
      GLASS:          { kwda: this.statics.kwWeapMaterialGlass,          perk: this.statics.perkSmithingGlass    },
      IRON:           { kwda: this.statics.kwWeapMaterialIron,           perk: null                              },
      NORDIC:         { kwda: this.statics.kwWeapMaterialNordic,         perk: this.statics.perkSmithingAdvanced },
      ORCISH:         { kwda: this.statics.kwWeapMaterialOrcish,         perk: this.statics.perkSmithingOrcish   },
      SILVER:         { kwda: this.statics.kwWeapMaterialSilver,         perk: this.statics.perkSmithingSilver   },
      STALHRIM:       { kwda: this.statics.kwWeapMaterialStalhrim,       perk: this.statics.perkSmithingAdvanced },
      STEEL:          { kwda: this.statics.kwWeapMaterialSteel,          perk: this.statics.perkSmithingSteel    },
      WOODEN:         { kwda: this.statics.kwWeapMaterialWood,           perk: null                              }
    };

    if (overrideMap[override]) {
      xelib.AddElement(weapon, 'KWDA\\.', overrideMap[override].kwda);
      helpers.overrideCraftingRecipes(this.cobj, armor, overrideMap[override].perk, this.patchFile);
    }
  }

  getWeaponTypeOverride(name) {
    const override = this.weapons.type_overrides.find((t) => name === t.weaponName);
    return override ? override.weaponType : null;
  }

  getWeaponMaterialOverrideString(name) {
    const override = this.weapons.material_overrides.find((o) => name.includes(o.weaponSubstring));
    return override ? override.materialOverride : null;
  }

  hasWeaponKeyword(weapon) {
    const kwda = function(kwda) { return xelib.HasArrayItem(weapon, 'KWDA', '', kwda); }
    return kwda('WeapMaterialDaedric') || kwda('WeapMaterialDragonbone') || kwda('WeapMaterialDraugr') ||
           kwda('WeapMaterialDraugrHoned') || kwda('WeapMaterialDwarven') || kwda('WeapMaterialEbony') ||
           kwda('WeapMaterialElven') || kwda('WeapMaterialFalmer') || kwda('WeapMaterialFalmerHoned') ||
           kwda('WeapMaterialGlass') || kwda('WeapMaterialImperial') || kwda('WeapMaterialOrcish') ||
           kwda('WeapMaterialSilver') || kwda('xxxWeapMaterialSilverRefined') || kwda('WeapMaterialSteel') ||
           kwda('WeapMaterialWood') || kwda('DLC2WeaponMaterialStalhrim') || kwda('DLC2WeaponMaterialNordic');
  }

  patchWeaponKeywords(weapon) {
    const name = xelib.FullName(weapon);
    const typeString = helper.getValueFromName(this.weapon.typeDefinitions, name, 'substring', 'typeBinding');

    if (!typeString) {
      this.patchBowType(weapon);
    }

    const noop = function(perk) { return; };
    const addp = function(weapon, perk) { helpers.addPerkScript(weapon, 'xxxAddPerkWhileEquipped', 'p', perk); };
    const broad = function(weapon) { this.checkBradSwordName(weapon); };

    const weaponKeywordMap = {
      BASTARDSWORD: { kwda: 'xxxWeapTypeBastardSword',  func: noop,   perk: null                              },
      BATTLESTAFF:  { kwda: 'xxxWeapTypeBattleStaff',   func: noop,   perk: null                              },
      BROADSWORD:   { kwda: 'xxxWeapTypeBroadsword',    func: broad,  perk: null                              },
      CLUB:         { kwda: 'xxxWeapTypeClub',          func: noop,   perk: null                              },
      CROSSBOW:     { kwda: 'MothNest1',                func: noop,   perk: null                              },
      GLAIVE:       { kwda: 'xxxWeapTypeGlaive',        func: noop,   perk: null                              },
      HALBERD:      { kwda: 'xxxWeapTypeHalberd',       func: noop,   perk: null                              },
      HATCHET:      { kwda: 'xxxWeapType',              func: noop,   perk: null                              },
      KATANA:       { kwda: 'xxxWeapTypeKatana',        func: noop,   perk: null                              },
      LONGBOW:      { kwda: 'MothNest2',                func: noop,   perk: null                              },
      LONGMACE:     { kwda: 'xxxWeapTypeLongmace',      func: noop,   perk: null                              },
      LONGSWORD:    { kwda: 'xxxWeapTypeLongsword',     func: noop,   perk: null                              },
      MAUL:         { kwda: 'xxxWeapTypeMaul',          func: noop,   perk: null                              },
      NODACHI:      { kwda: 'xxxWeapTypeNodachi',       func: noop,   perk: null                              },
      SABRE:        { kwda: 'xxxWeapTypeSabre',         func: noop,   perk: null                              },
      SCIMITAR:     { kwda: 'xxxWeapTypeScimitar',      func: noop,   perk: null                              },
      SHORTBOW:     { kwda: 'xxxWeapTypeBowShort',      func: noop,   perk: null                              },
      SHORTSPEAR:   { kwda: 'xxxWeapTypeShortspear',    func: addp,   perk: this.statics.perkWeaponShortspear },
      SHORTSWORD:   { kwda: 'xxxWeapTypeShortsword',    func: noop,   perk: null                              },
      TANTO:        { kwda: 'xxxWeapTypeTanto',         func: noop,   perk: null                              },
      UNARMED:      { kwda: 'xxxWeapTypeUnarmed',       func: noop,   perk: null                              },
      WAKIZASHI:    { kwda: 'xxxWeapTypeWakizashi',     func: noop,   perk: null                              },
      YARI:         { kwda: 'xxxWeapTypeYari',          func: addp,   perk: this.statics.perkWeaponYari       },
    };

    weaponKeywordMap.some((e) => {
      if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        xelib.AddElement(weapon, 'KWDA\\.', e.kwda);
        e.func(weapon, e.perk);
        return true;
      }
    });
  }

  patchWeaponDamage(weapon) {
    let baseDamage = this.getBaseDamage(weapon);
    let materialDamage = this.getWeaponMaterialDamageModifier(weeapon);
    let typeDamage = this.getWeaponTypeDamageModifier(weapon);

    if (baseDamage === null || materialDamage === null || typeDamage === null) {
      console.log(`${xelib.FullName(weapon)}: Base: ${baseDamage} Material: ${materialDamage} Type: ${typeDamage}`);
    }

    xelib.SetIntValue(weapon, 'DATA\\Damage', baseDamage + materialDamage + typeDamage);
  }

  getBaseDamage(weapon) {
    const s = this.statics;
    const kwda = helpers.getKwda(weapon);
    let base = null;

    if (kwda(s.kwWeapTypeSword) || kwda(s.kwWeapTypeWaraxe) || kwda(s.kwWeapTypeMace) || kwda(s.kwWeapTypeDagger)) {
      base = this.settings.weaponBaseStats.iDamageBaseOneHanded;
    }

    if (kwda(s.kwWeapTypeGreatsword) || kwda(s.kwWeapTypeWarhammer) || kwda(s.kwWeapTypeBattleaxe)) {
      base = this.settings.weaponBaseStats.iDamageBaseTwoHanded;
    }

    if (kwda(s.kwWeapTypeCrossbow)) {
      base = this.settings.weaponBaseStats.iDamageBaseCrossbow;
    }

    if (kwda(s.kwWeapTypeBow)) {
      base = this.settings.weaponBaseStats.iDamageBaseBow;
    }

    if (base === null) {
      console.log(`${xelib.FullName(weapon)}: Couldn't set base weapon damage.`);
    }

    return base;
  }

  getWeaponMaterialDamageModifier(weapon) {
    const name = xelib.FullName(weapon);
    let modifier = null;
    modifier = helpers.getValueFromName(this.weapons.materials, name, 'name', 'iDamage');

    if (modifier) { return modifier; }

    modifier = helpers.getModifierFromMap(this.keywordMaterialMap, this.weapons.materials, weapon, 'name', 'iDamage');

    if (modifier === null) {
      console.log(`${name}: Couldn't find material damage modifier for weapon.`);
    }

    return modifier;
  }

  getWeaponTypeDamageModifier(weapon) {
    let modifier;

    modifier = helpers.getModifierFromMap(this.keywordTypesMap, this.weapons.types, weapon, 'name', 'iDamage');

    if (modifier === null) {
      console.log(`${name}: Couldn't find type damage modifier for weapon.`);
    }

    return modifier;
  }

  patchWeaponReach(weapon) {
    const reach = this.getWeaponTypeFloatValueModifier(weapon, 'fReach');
    xelib.SetFloatValue(weapon, 'DNAM\\Reach', reach);
  }

  patchWeaponSpeed(weapon) {
    const speed = this.getWeaponTypeFloatValueModifier(weapon, 'fSpeed');
    xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed);
  }

  getWeaponTypeFloatValueModifier(weapon, field2) {
    let modifier = helpers.getModifierFromMap(this.skyreTypesMap, this.weapons.types, weapon, 'name', field2);

    if (modifier) { return modifier; }

    modifier = helpers.getValueFromName(this.weapons.types, xelib.FullName(weapon), 'name', field2);

    if (modifier) { return modifier; }

    modifier = helpers.getModifierFromMap(this.vanillaTypesMap, this.weapons.types, weapon, 'name', field2);

    if (modifier === null) {
      console.log(`${name}: Couldn't find type ${which} modifier for weapon.`);
    }

    return modifier;
  }

  modifyCrossbowCraftingRecipe(weapon) {
    const name = xelib.FullName(weapon);

    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow)) { return; }
    if (this.weapons.excluded_crossbows.find((e) => name.includes(e))) { return; }

    this.cobj.forEach((cobj) => {
      const bnam = xelib.GetLinksTo(recipe, 'BNAM');
      const cnam = xelib.GetLinksTo(recipe, 'CNAM');
      const bench = xelib.GetRecord(0, parseInt(this.statics.kwCraftingSmithingForge, 16));

      if (!cnam || !xelib.GetHexFormID(cnam) !== xelib.GetHexFormID(weapon)) { return; }
      if (!bnam || !xelib.ElementEquals(bnam, bench)) {
        xelib.SetValue(recipe, 'BNAM', this.statics.kwCraftingSmithingForge);
      }

      const recipe = xelib.CopyElement(cobj, this.patchFile);
      helpers.createHasPerkCondition(recipe, 10000000, 1, this.statics.perkMarksmanshipBallistics);
    });
  }

  processCrossbow(weapon) {
    const name = xelib.FullName(weapon);

    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow)) { return; }
    if (this.weapons.excluded_crossbows.find((e) => name.includes(e))) { return; }

    xelib.AddElementValue(weapon, 'DESC', 'Ignores 50% armor.');

    let requiredPerks = [];
    let secondaryIngredients = [];

    let newName = `Recurve ${name}`;
    const newRecurveCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveCrossbow, 'FULL', newName);
    this.applyRecurveCrossbowChanges(newRecurveCrossbow);
    this.addTemperingRecipe(newRecurveCrossbow);
    this.addMeltdownRecipe(newRecurveCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipRecurve);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newRecurveCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Arbalest ${name}`;
    const newArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newArbalestCrossbow, 'FULL', newName);
    this.applyArbalestCrossbowChanges(newArbalestCrossbow);
    helpers.addPerkScript(newArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalest);
    this.addTemperingRecipe(newArbalestCrossbow);
    this.addMeltdownRecipe(newArbalestCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipArbalest);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newArbalestCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Lightweight ${name}`;
    const newLightweightCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newLightweightCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newLightweightCrossbow, 'FULL', newName);
    this.applyLightweightCrossbowChanges(newLightweightCrossbow);
    this.addTemperingRecipe(newLightweightCrossbow);
    this.addMeltdownRecipe(newLightweightCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipLightweightConstruction);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newLightweightCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Silenced ${name}`;
    const newSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newSilencedCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newSilencedCrossbow, 'FULL', newName);
    this.applySilencedCrossbowChanges(newSilencedCrossbow);
    helpers.addPerkScript(newSilencedCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowSilenced);
    this.addTemperingRecipe(newSilencedCrossbow);
    this.addMeltdownRecipe(newSilencedCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipSilencer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newSilencedCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Recurve Arbalest ${name}`;
    const newRecurveArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveArbalestCrossbow, 'FULL', newName);
    this.applyRecurveCrossbowChanges(newRecurveArbalestCrossbow);
    this.applyArbalestCrossbowChanges(newRecurveArbalestCrossbow);
    helpers.addPerkScript(newArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalest);
    this.addTemperingRecipe(newRecurveArbalestCrossbow);
    this.addMeltdownRecipe(newRecurveArbalestCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipRecurve);
    requiredPerks.push(this.statics.perkMarksmanshipArbalest);
    requiredPerks.push(this.statics.perkMarksmanshipEngineer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newRecurveArbalestCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Recurve Lightweight ${name}`;
    const newRecurveLightweightCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveLightweightCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveLightweightCrossbow, 'FULL', newName);
    this.applyRecurveCrossbowChanges(newRecurveLightweightCrossbow);
    this.applyLightweightCrossbowChanges(newRecurveLightweightCrossbow);
    this.addTemperingRecipe(newRecurveLightweightCrossbow);
    this.addMeltdownRecipe(newRecurveLightweightCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipRecurve);
    requiredPerks.push(this.statics.perkMarksmanshipLightweightConstruction);
    requiredPerks.push(this.statics.perkMarksmanshipEngineer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newRecurveLightweightCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Recurve Silenced ${name}`;
    const newRecurveSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveSilencedCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveSilencedCrossbow, 'FULL', newName);
    this.applyRecurveCrossbowChanges(newRecurveSilencedCrossbow);
    this.applySilencedCrossbowChanges(newRecurveSilencedCrossbow);
    helpers.addPerkScript(newRecurveSilencedCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowSilenced);
    this.addTemperingRecipe(newRecurveSilencedCrossbow);
    this.addMeltdownRecipe(newRecurveSilencedCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipRecurve);
    requiredPerks.push(this.statics.perkMarksmanshipSilencer);
    requiredPerks.push(this.statics.perkMarksmanshipEngineer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newRecurveSilencedCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Lightweight Arbalest ${name}`;
    const newLightweightArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newLightweightArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newLightweightArbalestCrossbow, 'FULL', newName);
    this.applyArbalestCrossbowChanges(newLightweightArbalestCrossbow);
    this.applyLightweightCrossbowChanges(newLightweightArbalestCrossbow);
    helpers.addPerkScript(newLightweightArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalest);
    this.addTemperingRecipe(newLightweightArbalestCrossbow);
    this.addMeltdownRecipe(newLightweightArbalestCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipLightweightConstruction);
    requiredPerks.push(this.statics.perkMarksmanshipArbalest);
    requiredPerks.push(this.statics.perkMarksmanshipEngineer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newLightweightArbalestCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Silenced Arbalest ${name}`;
    const newSilencedArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newSilencedArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newSilencedArbalestCrossbow, 'FULL', newName);
    this.applyArbalestCrossbowChanges(newSilencedArbalestCrossbow);
    this.applySilencedCrossbowChanges(newSilencedArbalestCrossbow);
    helpers.addPerkScript(newSilencedArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalestSilenced);
    this.addTemperingRecipe(newSilencedArbalestCrossbow);
    this.addMeltdownRecipe(newSilencedArbalestCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipSilencer);
    requiredPerks.push(this.statics.perkMarksmanshipArbalest);
    requiredPerks.push(this.statics.perkMarksmanshipEngineer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newSilencedArbalestCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    newName = `Lightweight Silenced ${name}`;
    const newLightweightSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newLightweightSilencedCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newLightweightSilencedCrossbow, 'FULL', newName);
    this.applyLightweightCrossbowChanges(newLightweightSilencedCrossbow);
    this.applySilencedCrossbowChanges(newLightweightSilencedCrossbow);
    helpers.addPerkScript(newLightweightSilencedCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowSilenced);
    this.addTemperingRecipe(newLightweightSilencedCrossbow);
    this.addMeltdownRecipe(newLightweightSilencedCrossbow);
    requiredPerks.push(this.statics.perkMarksmanshipBallistics);
    requiredPerks.push(this.statics.perkMarksmanshipLightweightConstruction);
    requiredPerks.push(this.statics.perkMarksmanshipSilencer);
    requiredPerks.push(this.statics.perkMarksmanshipEngineer);
    secondaryIngredients.push(this.statics.leatherStrips);
    secondaryIngredients.push(this.statics.firewood);
    secondaryIngredients.push(xelib.GetHexFormID(weapon));
    this.addCraftingRecipe(newLightweightSilencedCrossbow, requiredPerks, secondaryIngredients);
    requiredPerks = [];
    secondaryIngredients = [];

    helpers.addPerkScript(weapon, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbow);
  }

  applyRecurveCrossbowChanges(weapon) {
    const baseDamage = this.getBaseDamage(weapon);
    const materialDamage = this.getWeaponMaterialDamageModifier(weapon);
    const typeDamage = this.getWeaponTypeDamageModifier(weapon);
    const recurveDamage = this.settings.weaponBaseStats.iDamageBonusRecurveCrossbow;
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetIntValue(weapon, 'DATA\\Damage', baseDamage + materialDamage + typeDamage + recurveDamage);
    xelib.AddElementValue(weapon, 'DESC', `${desc} Deals additional damage.`);
  }

  applyArbalestCrossbowChanges(weapon) {
    const speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
    const weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetFloatValue(weapon, speed + this.settings.weaponBaseStats.fSpeedBonusArbalestCrossbow);
    xelib.SetFloatValue(weapon, weight + this.settings.weaponBaseStats.fWeightFactorArbalestCrossbow);
    xelib.AddElementValue(weapon, `${desc} Deals double damage against blocking enemies but fires slower.`);
  }

  applyLightweightCrossbowChanges(weapon) {
    const speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
    const weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetFloatValue(weapon, speed + this.settings.weaponBaseStats.fSpeedBonusLightweightCrossbow);
    xelib.SetFloatValue(weapon, weight + this.settings.weaponBaseStats.fWeightFactorLightweightCrossbow);
    xelib.AddElementValue(weapon, `${desc} Has increased attack speed.`);
  }

  applySilencedCrossbowChanges(weapon) {
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.AddElementValue(weapon, `${desc} Deals increased sneak attack damage.`);
  }

  processSilverWeapon(weapon) {
    if (!xelib.HasArrayItem(weapon, this.statics.kwWeapMaterialSilver)) { return; }

    for (let i = 0; i < this.refinedSilverWeapons.length; i++) {
      if (!xelib.FullName('weapon').includes(xelib.FullName('w'))) {
        return;
      }
    }

    const newName = `Refined ${xelib.FullName(weapon)}`;
    const desc = 'These supreme weapons set undead enemies ablaze, dealing extra damage.';
    const newRefinedSilverWeapon = xelib.CopyElement(weapon, this.patchFile);
    xelib.AddElementValue(newRefinedSilverWeapon, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRefinedSilverWeapon, 'FULL', newName);
    xelib.AddElementValue(newRefinedSilverWeapon, 'DESC', desc);
    xelib.AddElement(newRefinedSilverWeapon, 'KWDA\\.', this.statics.kwWeapMaterialSilverRefined);
    this.patchWeaponDamage(newRefinedSilverWeapon);
    this.patchWeaponReach(newRefinedSilverWeapon);
    this.patchWeaponSpeed(newRefinedSilverWeapon);

    if (!xelib.HasScript(newRefinedSilverWeapon, 'SilverSwordScript')) {
      const vmad = xelib.AddElement(weapon, 'VMAD');
      xelib.SetIntValue(vmad, 'Version', 5);
      xelib.SetIntValue(vmad, 'Object Format', 2);
      const script = xelib.AddElement(vmad, 'Scripts\\.');
      xelib.SetValue(script, 'scriptName', 'SilverSwordScript');
      const property = xelib.AddElement(script, 'Properties\\.');
      xelib.SetValue(property, 'propertyName', 'SilverPerk');
      xelib.SetIntValue(property, 'Type', 1);
      xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', this.statics.perkWeaponSilverRefined);
    }

    this.addTemperingRecipe(patch, newRefinedSilverWeapon);
    const ingredients = [this.statics.ingotGold, this.statics.ingotQuicksilver, xelib.GetHexFormID(newRefinedSilverWeapon)];
    this.addCraftingRecipe(newRefinedSilverWeapon, [this.statics.perkSmithingSilverRefined], ingredients);
    this.addWeaponMeltdownRecipe(newRefinedSilverWeapon);
  }

  addTemperingRecipe(weapon) {
    let input;
    let perk;

    this.keywordTemperMap.some((e) => {
      if (xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        input = e.input;
        perk = e.perk;
        return true;
      }
    });

    if (!input) { return; }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_TEMPER_${xelib.FullName(weapon)}`);
    xelib.AddElement(newRecipe, 'Items');

    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', input);
    xelib.SetIntValue(ingredient, 'CNTO\\Count', 1);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingSharpeningWheel);

    if (perk) {
      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      helpers.updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    }
  }

  addMeltdownRecipe(weapon) {
    const s = this.statics;
    const kwda = helpers.getKwda(weapon);
    let outputQuantity = 1;
    let inputQuantity = 1;
    let output, perk, station;

    if (kwda(s.kwWeapTypeBattleaxe) || kwda(s.kwWeapTypeGreatsword) ||
        kwda(s.kwWeapTypeWarhammer) || kwda(s.kwWeapTypeBow)) {
      outputQuantity++;
    } else if (kwda(s.kwWeapTypeDagger)) {
      inputQuantity++;
    }

    this.keywordTemperMap.some((e) => {
      if (xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        if (e.kwda == s.kwWeapMaterialDaedric || e.kwda == s.kwWeapMaterialDraugr || e.kwda == s.kwWeapMaterialDraugrHoned) {
          return;
        }

        input = e.input;
        perk = e.perk;
        return true;
      }
    });

    if (!input) { return; }

    if (kwda(s.kwWeapMaterialDaedric)) {
      outputQuantity++;
    } else if (kwda(s.kwWeapMaterialDraugr) || kwda(s.kwWeapMaterialDraugrHoned)) {
      inputQuantity++;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_TEMPER_${xelib.FullName(weapon)}`);
    xelib.AddElement(newRecipe, 'Items');

    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', input);
    xelib.SetIntValue(ingredient, 'CNTO\\Count', 1);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmelter);

    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    helpers.updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

    if (perk) {
      helpers.createHasPerkCondition(newRecipe, 10000000, 1, perk);
    }

    helpers.createGetItemCountCondition(newRecipe, 11000000, 1, xelib.GetHexFormID(weapon));
  }

  addCraftingRecipe(weapon, requiredPerks, secondaryIngredients) {
    let input, perk;

    this.keywordTemperMap.some((e) => {
      if (xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        input = e.input;
        perk = e.perk;
        return true;
      }
    });

    if (!input) { return; }

    const newRecipe = xelib.AddElement(this.patch, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_WEAPON_${xelib.FullName(weapon)}`);

    xelib.AddElement(newRecipe, 'Items');
    const baseItem = xelib.GetElement(newRecipe, 'Items\\[0]')
    xelib.SetValue(baseItem, 'CNTO\\Item', input);
    xelib.SetIntValue(baseItem, 'CNTO\\Count', 2);

    secondaryIngredients.forEach((ingredient) => {
      const secondaryItem = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(secondaryItem, 'CNTO\\Item', ingredient);
      xelib.SetIntValue(secondaryItem, 'CNTO\\Count', 1);
    });

    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));

    xelib.AddElement(newRecipe, 'Conditions');

    requiredPerks.forEach((perk, index) => {
      let condition;

      if (index == 0) {
        condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      } else {
        condition = xelib.AddElement(newRecipe, 'Conditions\\.');
      }

      xelib.updateHasPerkCondition(recipe, condition, 10000000, 1, perk);
    });

    if (perk) {
      helpers.createHasPerkCondition(recipe, 10000000, 1, perk);
    }
  }

  createKeywordMaps() {
    const s = this.statics;
    this.keywordMaterialMap = [
      { kwda: s.kwWeapMaterialDaedric,      name: 'Daedric'       },
      { kwda: s.kwWeapMaterialDragonbone,   name: 'Dragonbone'    },
      { kwda: s.kwWeapMaterialDraugr,       name: 'Draugr'        },
      { kwda: s.kwWeapMaterialDraugrHoned,  name: 'Draugr Honed'  },
      { kwda: s.kwWeapMaterialDwarven,      name: 'Dwarven'       },
      { kwda: s.kwWeapMaterialEbony,        name: 'Ebony'         },
      { kwda: s.kwWeapMaterialElven,        name: 'Elven'         },
      { kwda: s.kwWeapMaterialFalmer,       name: 'Daedric'       },
      { kwda: s.kwWeapMaterialFalmerHoned,  name: 'Falmer Honed'  },
      { kwda: s.kwWeapMaterialGlass,        name: 'Glass'         },
      { kwda: s.kwWeapMaterialImperial,     name: 'Imperial'      },
      { kwda: s.kwWeapMaterialIron,         name: 'Iron'          },
      { kwda: s.kwWeapMaterialNordic,       name: 'Nordic'        },
      { kwda: s.kwWeapMaterialOrcish,       name: 'Orcish'        },
      { kwda: s.kwWeapMaterialSilver,       name: 'Silver'        },
      { kwda: s.kwWeapMaterialStalhrim,     name: 'Stalhrim'      },
      { kwda: s.kwWeapMaterialSteel,        name: 'Steel'         },
      { kwda: s.kwWeapMaterialWood,         name: 'Wood'          }
    ];

    this.skyreTypesMap = [
      { kwda: s.kwWeapTypeBastardSword,     name: "Bastard Sword" },
      { kwda: s.kwWeapTypeBattlestaff,      name: "Battlestaff"   },
      { kwda: s.kwWeapTypeClub,             name: "Club"          },
      { kwda: s.kwWeapTypeCrossbow,         name: "Crossbow"      },
      { kwda: s.kwWeapTypeGlaive,           name: "Glaive"        },
      { kwda: s.kwWeapTypeHalberd,          name: "Halberd"       },
      { kwda: s.kwWeapTypeHatchet,          name: "Hatchet"       },
      { kwda: s.kwWeapTypeKatana,           name: "Katana"        },
      { kwda: s.kwWeapTypeLongbow,          name: "Longbow"       },
      { kwda: s.kwWeapTypeLongmace,         name: "Longmace"      },
      { kwda: s.kwWeapTypeLongsword,        name: "Longsword"     },
      { kwda: s.kwWeapTypeMaul,             name: "Maul"          },
      { kwda: s.kwWeapTypeNodachi,          name: "Nodachi"       },
      { kwda: s.kwWeapTypeSaber,            name: "Saber"         },
      { kwda: s.kwWeapTypeScimitar,         name: "Scimitar"      },
      { kwda: s.kwWeapTypeShortbow,         name: "Shortbow"      },
      { kwda: s.kwWeapTypeShortspear,       name: "Shortspear"    },
      { kwda: s.kwWeapTypeShortsword,       name: "Shortsword"    },
      { kwda: s.kwWeapTypeTanto,            name: "Tanto"         },
      { kwda: s.kwWeapTypeUnarmed,          name: "Unarmed"       },
      { kwda: s.kwWeapTypeWakizashi,        name: "Wakizashi"     },
      { kwda: s.kwWeapTypeYari,             name: "Yari"          }
    ];

    this.vanillaTypesMap = [
      { kwda: s.kwWeapTypeBattleaxe,        name: "Battleaxe"     },
      { kwda: s.kwWeapTypeBow,              name: "Bow"           },
      { kwda: s.kwWeapTypeSword,            name: "Broadsword"    },
      { kwda: s.kwWeapTypeDagger,           name: "Dagger"        },
      { kwda: s.kwWeapTypeGreatsword,       name: "Greatsword"    },
      { kwda: s.kwWeapTypeMace,             name: "Mace"          },
      { kwda: s.kwWeapTypeWaraxe,           name: "Waraxe"        },
      { kwda: s.kwWeapTypeWarhammer,        name: "Warhammer"     }
    ];

    this.keywordTypesMap = this.skyreTypesMap.concat(this.vanillaTypesMap);

    this.keywordTemperMap = [
      { kwda: this.statics.kwWeapMaterialDaedric,       input: s.ingotEbony,          perk: s.perkSmithingDaedric },
      { kwda: this.statics.kwWeapMaterialDragonbone,    input: s.dragonBone,          perk: s.perkSmithingDragon },
      { kwda: this.statics.kwWeapMaterialDraugr,        input: s.ingotSteel,          perk: s.perkSmithingSteel },
      { kwda: this.statics.kwWeapMaterialDraugrHoned,   input: s.ingotSteel,          perk: s.perkSmithinSteel },
      { kwda: this.statics.kwWeapMaterialDwarven,       input: s.ingotDwarven,        perk: s.perkSmithingDwarven },
      { kwda: this.statics.kwWeapMaterialEbony,         input: s.ingotEbony,          perk: s.perkSmithingEbony },
      { kwda: this.statics.kwWeapMaterialElven,         input: s.ingotMoonstone,      perk: s.perkSmithingElven },
      { kwda: this.statics.kwWeapMaterialFalmer,        input: s.ingotchaurusChitin,  perk: null },
      { kwda: this.statics.kwWeapMaterialFalmerHoned,   input: s.ingotchaurusChitin,  perk: null },
      { kwda: this.statics.kwWeapMaterialGlass,         input: s.ingotMalachite,      perk: s.perkSmithingGlass },
      { kwda: this.statics.kwWeapMaterialImperial,      input: s.ingotSteel,          perk: s.perkSmithingSteel },
      { kwda: this.statics.kwWeapMaterialIron,          input: s.ingotIron,           perk: null },
      { kwda: this.statics.kwWeapMaterialOrcish,        input: s.ingotOrichalcum,     perk: s.perkSmithingOrcish },
      { kwda: this.statics.kwWeapMaterialSilver,        input: s.ingotSilver,         perk: s.perkSmithingSilver },
      { kwda: this.statics.kwWeapMaterialSilverRefined, input: s.ingotSilver,         perk: s.perkSmithingSilver },
      { kwda: this.statics.kwWeapMaterialSteel,         input: s.ingotSteel,          perk: s.perkSmithingSteel },
      { kwda: this.statics.kwWeapMaterialWood,          input: s.ingotIron,           perk: null },
      { kwda: this.statics.kwWeapMaterialStalhrim,      input: s.oreStalhrim,         perk: s.perkSmithingAdvanced },
      { kwda: this.statics.kwWeapMaterialNordic,        input: s.ingotQuicksilver,    perk: s.perkSmithingAdvanced }
    ];
  }
}
