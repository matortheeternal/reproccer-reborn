import {
  addPerkScript,
  createGetItemCountCondition,
  createHasPerkCondition,
  getKwda,
  getModifierFromMap,
  getValueFromName,
  overrideCraftingRecipes,
  safeHasArrayItem,
  safeNotHasArrayItem,
  updateHasPerkCondition
} from './helpers';

export default class WeaponPatcher {
  names = {};

  constructor(helpers, locals, patch, settings) {
    this.baseStats = settings.weapons.baseStats;
    this.cobj = locals.cobj;
    this.helpers = helpers;
    this.locals = locals;
    this.modifiers = settings.weapons.modifiers;
    this.patchFile = patch;
    this.rules = locals.rules.weapons;
    this.settings = settings;
    this.statics = locals.statics;

    // sanitize user modified values
    Object.keys(this.modifiers).map(k => {
      if (this.modifiers[k] < 0) {
        this.modifiers = 0;
      }

      return this.modifiers[k];
    });

    this.createKeywordMaps();
  }

  load = {
    filter: record => {
      if (!this.settings.weapons.enabled) {
        return false;
      }

      const name = xelib.FullName(record);

      if (name && this.rules.excludedWeapons.find(e => name.includes(e))) {
        return false;
      }

      if (safeHasArrayItem(record, 'KWDA', '', this.statics.kwWeapTypeStaff)) {
        return false;
      }

      if (xelib.HasElement(record, 'CNAM')) {
        return true;
      }

      if (xelib.GetFlag(record, 'DNAM\\Flags', 'Non-playable')) {
        return false;
      }

      if (!name) {
        return false;
      }

      return true;
    },

    signature: 'WEAP'
  };

  patch = weapon => {
    this.names[weapon] = xelib.FullName(weapon) || '';

    if (xelib.HasElement(weapon, 'CNAM')) {
      this.checkBroadswordName(weapon, true);
      this.patchBowType(weapon, true);
      return;
    }

    this.checkOverrides(weapon);
    this.patchWeaponKeywords(weapon);
    this.patchWeaponDamage(weapon);
    this.patchWeaponReach(weapon);
    this.patchWeaponSpeed(weapon);
    this.processCrossbow(weapon);
    this.processSilverWeapon(weapon);
    this.addMeltdownRecipe(weapon);
    this.modifyRecipes(weapon);
  };

  checkBroadswordName = (weapon, enchanted) => {
    if (enchanted && !xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeSword)) {
      return;
    }
    if (this.names[weapon].includes('Broadsword')) {
      return;
    }

    this.names[weapon] = this.names[weapon].replace('Sword', 'Broadsword');
    xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
  };

  patchBowType(weapon, enchanted) {
    const kwda = getKwda(weapon);
    if (!kwda(this.statics.kwWeapTypeBow) || kwda(this.statics.kwWeapTypeCrossbow)) {
      return;
    }
    if (kwda(this.statics.kwWeapTypeLongbow) || kwda(this.statics.kwWeapTypeShortbow)) {
      return;
    }

    const name = this.names[weapon];
    if (
      (enchanted && name.includes('Longbow')) ||
      name.includes('Shortbow') ||
      name.includes('Crossbow')
    ) {
      return;
    }

    xelib.AddElementValue(weapon, 'KWDA\\.', this.statics.kwWeapTypeShortbow);

    if (this.names[weapon].includes('Bow')) {
      this.names[weapon] = this.names[weapon].replace('Bow', 'Shortbow');
      xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
    } else {
      this.names[weapon] = `${this.names[weapon]} [Shortbow]`;
      xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
    }
  }

  checkOverrides(weapon) {
    const type = this.getWeaponTypeOverride(this.names[weapon]);

    if (type) {
      this.names[weapon] = `${this.names[weapon]} [${type}]`;
      xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
    }

    const override = this.getWeaponMaterialOverrideString(this.names[weapon]);

    if (!override || this.hasWeaponKeyword(weapon)) {
      return;
    }

    // prettier-ignore
    const overrideMap = {
      ADVANCED:   { kwda: this.statics.kwWeapMaterialAdvanced,    perk: this.statics.perkSmithingAdvanced },
      DRAGONBONE: { kwda: this.statics.kwWeapMaterialDragonPlate, perk: this.statics.perkSmithingDragon   },
      DAEDRIC:    { kwda: this.statics.kwWeapMaterialDaedric,     perk: this.statics.perkSmithingDaedric  },
      DRAUGR:     { kwda: this.statics.kwWeapMaterialDraugr,      perk: this.statics.perkSmithingSteel    },
      DWARVEN:    { kwda: this.statics.kwWeapMaterialDwarven,     perk: this.statics.perkSmithingDwarven  },
      EBONY:      { kwda: this.statics.kwWeapMaterialEbony,       perk: this.statics.perkSmithingEbony    },
      ELVEN:      { kwda: this.statics.kwWeapMaterialElven,       perk: this.statics.perkSmithingElven    },
      FALMER:     { kwda: this.statics.kwWeapMaterialFalmer,      perk: this.statics.perkSmithingAdvanced },
      GLASS:      { kwda: this.statics.kwWeapMaterialGlass,       perk: this.statics.perkSmithingGlass    },
      IRON:       { kwda: this.statics.kwWeapMaterialIron,        perk: null                              },
      NORDIC:     { kwda: this.statics.kwWeapMaterialNordic,      perk: this.statics.perkSmithingAdvanced },
      ORCISH:     { kwda: this.statics.kwWeapMaterialOrcish,      perk: this.statics.perkSmithingOrcish   },
      SILVER:     { kwda: this.statics.kwWeapMaterialSilver,      perk: this.statics.perkSmithingSilver   },
      STALHRIM:   { kwda: this.statics.kwWeapMaterialStalhrim,    perk: this.statics.perkSmithingAdvanced },
      STEEL:      { kwda: this.statics.kwWeapMaterialSteel,       perk: this.statics.perkSmithingSteel    },
      WOODEN:     { kwda: this.statics.kwWeapMaterialWood,        perk: null                              }
    };

    if (overrideMap[override]) {
      xelib.AddElementValue(weapon, 'KWDA\\.', overrideMap[override].kwda);
      overrideCraftingRecipes(this.cobj, weapon, overrideMap[override].perk, this.patchFile);
    }
  }

  getWeaponTypeOverride(name) {
    const override = this.rules.typeOverrides.find(t => name === t.name);
    return override ? override.type : null;
  }

  getWeaponMaterialOverrideString(name) {
    const override = this.rules.materialOverrides.find(o => name.includes(o.substring));
    return override ? override.material : null;
  }

  hasWeaponKeyword(weapon) {
    const s = this.statics;
    const kwda = k => xelib.HasArrayItem(weapon, 'KWDA', '', k);

    return (
      !kwda(s.kwWeapMaterialDaedric) ||
      kwda(s.kwWeapMaterialDragonbone) ||
      kwda(s.kwWeapMaterialDraugr) ||
      kwda(s.kwWeapMaterialDraugrHoned) ||
      kwda(s.kwWeapMaterialDwarven) ||
      kwda(s.kwWeapMaterialEbony) ||
      kwda(s.kwWeapMaterialElven) ||
      kwda(s.kwWeapMaterialFalmer) ||
      kwda(s.kwWeapMaterialFalmerHoned) ||
      kwda(s.kwWeapMaterialGlass) ||
      kwda(s.kwWeapMaterialImperial) ||
      kwda(s.kwWeapMaterialOrcish) ||
      kwda(s.kwWeapMaterialSilver) ||
      kwda(s.kwWeapMaterialSilverRefined) ||
      kwda(s.kwWeapMaterialSteel) ||
      kwda(s.kwWeapMaterialWood) ||
      kwda(s.kwWeapMaterialStalhrim) ||
      kwda(s.kwWeapMaterialNordic)
    );
  }

  patchWeaponKeywords(weapon) {
    const typeString = getValueFromName(
      this.rules.typeDefinitions,
      this.names[weapon],
      'substring',
      'binding'
    );

    if (!typeString) {
      this.patchBowType(weapon);
      return;
    }

    const s = this.statics;
    const noop = () => {};
    const addp = (w, p) => addPerkScript(w, 'xxxAddPerkWhileEquipped', 'p', p);
    const broad = w => this.checkBroadswordName(w);

    // prettier-ignore
    const weaponKeywordMap = {
      BASTARDSWORD: { kwda: s.kwWeapTypeBastardSword, func: noop,   perk: null                              },
      BATTLESTAFF:  { kwda: s.kwWeapTypeBattlestaff,  func: noop,   perk: null                              },
      BROADSWORD:   { kwda: s.kwWeapTypeBroadsword,   func: broad,  perk: null                              },
      CLUB:         { kwda: s.kwWeapTypeClub,         func: noop,   perk: null                              },
      CROSSBOW:     { kwda: s.kwWeapTypeCrossbow,     func: noop,   perk: null                              },
      GLAIVE:       { kwda: s.kwWeapTypeGlaive,       func: noop,   perk: null                              },
      HALBERD:      { kwda: s.kwWeapTypeHalberd,      func: noop,   perk: null                              },
      HATCHET:      { kwda: s.kwWeapTypeHatchet,      func: noop,   perk: null                              },
      KATANA:       { kwda: s.kwWeapTypeKatana,       func: noop,   perk: null                              },
      LONGBOW:      { kwda: s.kwWeapTypeLongbow,      func: noop,   perk: null                              },
      LONGMACE:     { kwda: s.kwWeapTypeLongmace,     func: noop,   perk: null                              },
      LONGSWORD:    { kwda: s.kwWeapTypeLongsword,    func: noop,   perk: null                              },
      MAUL:         { kwda: s.kwWeapTypeMaul,         func: noop,   perk: null                              },
      NODACHI:      { kwda: s.kwWeapTypeNodachi,      func: noop,   perk: null                              },
      SABRE:        { kwda: s.kwWeapTypeSaber,        func: noop,   perk: null                              },
      SCIMITAR:     { kwda: s.kwWeapTypeScimitar,     func: noop,   perk: null                              },
      SHORTBOW:     { kwda: s.kwWeapTypeShortbow,     func: noop,   perk: null                              },
      SHORTSPEAR:   { kwda: s.kwWeapTypeShortspear,   func: addp,   perk: this.statics.perkWeaponShortspear },
      SHORTSWORD:   { kwda: s.kwWeapTypeShortsword,   func: noop,   perk: null                              },
      TANTO:        { kwda: s.kwWeapTypeTanto,        func: noop,   perk: null                              },
      UNARMED:      { kwda: s.kwWeapTypeUnarmed,      func: noop,   perk: null                              },
      WAKIZASHI:    { kwda: s.kwWeapTypeWakizashi,    func: noop,   perk: null                              },
      YARI:         { kwda: s.kwWeapTypeYari,         func: addp,   perk: this.statics.perkWeaponYari       },
    };

    const map = weaponKeywordMap[typeString];
    if (map && safeNotHasArrayItem(weapon, 'KWDA', '', map.kwda)) {
      xelib.AddArrayItem(weapon, 'KWDA', '', map.kwda);
      map.func(weapon, map.perk);
    }
  }

  patchWeaponDamage(weapon) {
    const baseDamage = this.getBaseDamage(weapon);
    const materialDamage = this.getWeaponMaterialDamageModifier(weapon);
    const typeDamage = this.getWeaponTypeDamageModifier(weapon);
    const modifier = this.getKeywordWeaponDamageModifier(weapon);
    let damage = (baseDamage + materialDamage + typeDamage) * modifier;

    if (damage < 0) {
      damage = 0;
    }

    if (baseDamage === null || materialDamage === null || typeDamage === null) {
      this.log(weapon, `Base: ${baseDamage} Material: ${materialDamage} Type: ${typeDamage}`);
    }

    xelib.SetUIntValue(weapon, 'DATA\\Damage', damage);
  }

  getBaseDamage(weapon) {
    const s = this.statics;
    const kwda = getKwda(weapon);
    let base = null;

    if (
      kwda(s.kwWeapTypeSword) ||
      kwda(s.kwWeapTypeWaraxe) ||
      kwda(s.kwWeapTypeMace) ||
      kwda(s.kwWeapTypeDagger)
    ) {
      base = this.baseStats.damage.oneHanded;
    }

    if (
      kwda(s.kwWeapTypeGreatsword) ||
      kwda(s.kwWeapTypeWarhammer) ||
      kwda(s.kwWeapTypeBattleaxe)
    ) {
      base = this.baseStats.damage.twoHanded;
    }

    if (kwda(s.kwWeapTypeCrossbow)) {
      base = this.baseStats.damage.crossbow;
    }

    if (kwda(s.kwWeapTypeBow)) {
      base = this.baseStats.damage.bow;
    }

    if (base === null) {
      this.log(weapon, `Couldn't set base weapon damage.`);
    }

    return base;
  }

  getWeaponMaterialDamageModifier(weapon) {
    let modifier = null;
    modifier = getValueFromName(this.rules.materials, this.names[weapon], 'name', 'damage');

    if (modifier) {
      return modifier;
    }

    modifier = getModifierFromMap(
      this.keywordMaterialMap,
      this.rules.materials,
      weapon,
      'name',
      'damage'
    );

    if (modifier === null) {
      this.log(weapon, `Couldn't find material damage modifier for weapon.`);
    }

    return modifier;
  }

  getWeaponTypeDamageModifier(weapon) {
    const modifier = getModifierFromMap(
      this.keywordTypesMap,
      this.rules.types,
      weapon,
      'name',
      'damage',
      false
    );

    if (modifier === null) {
      this.log(weapon, `Couldn't find type damage modifier for weapon.`);
    }

    return modifier;
  }

  getKeywordWeaponDamageModifier(weapon) {
    const kwda = getKwda(weapon);
    let modifier = 1;

    if (kwda(this.statics.weaponStrongerLow)) {
      modifier = this.modifiers.weaponStrongerLow;
    } else if (kwda(this.statics.weaponStrongerMedium)) {
      modifier = this.modifiers.weaponStrongerMedium;
    } else if (kwda(this.statics.weaponStrongerHigh)) {
      modifier = this.modifiers.weaponStrongerHigh;
    } else if (kwda(this.statics.weaponWeakerLow)) {
      modifier = this.modifiers.weaponWeakerLow;
    } else if (kwda(this.statics.weaponWeakerMedium)) {
      modifier = this.modifiers.weaponWeakerMedium;
    } else if (kwda(this.statics.weaponWeakerHigh)) {
      modifier = this.modifiers.weaponWeakerHigh;
    }

    return modifier;
  }

  patchWeaponReach(weapon) {
    const reach = this.getWeaponTypeFloatValueModifier(weapon, 'reach');
    xelib.SetFloatValue(weapon, 'DNAM\\Reach', reach);
  }

  patchWeaponSpeed(weapon) {
    const speed = this.getWeaponTypeFloatValueModifier(weapon, 'speed');
    xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed);
  }

  getWeaponTypeFloatValueModifier(weapon, field2) {
    let modifier = getModifierFromMap(
      this.skyreTypesMap,
      this.rules.types,
      weapon,
      'name',
      field2,
      false
    );

    if (modifier) {
      return modifier;
    }

    modifier = getValueFromName(this.rules.types, this.names[weapon], 'name', field2, false);

    if (modifier) {
      return modifier;
    }

    modifier = getModifierFromMap(
      this.vanillaTypesMap,
      this.rules.types,
      weapon,
      'name',
      field2,
      false
    );

    if (modifier === null) {
      this.log(weapon, `Couldn't find type ${field2} modifier for weapon.`);
    }

    return modifier === null ? 0 : modifier;
  }

  modifyRecipes(weapon) {
    const weaponFormID = xelib.GetFormID(weapon);
    const weaponIsCrossbow = xelib.HasArrayItem(
      weapon,
      'KWDA',
      '',
      this.statics.kwWeapTypeCrossbow
    );
    const excludedCrossbow = this.rules.excludedCrossbows.find(e => this.names[weapon].includes(e));

    this.cobj.forEach(recipe => {
      this.modifyCrossbowCraftingRecipe(
        weapon,
        weaponFormID,
        weaponIsCrossbow,
        excludedCrossbow,
        recipe
      );
      this.modifyTemperingRecipe(weapon, weaponFormID, recipe);
    });
  }

  modifyCrossbowCraftingRecipe(weapon, weaponFormID, weaponIsCrossbow, excludedCrossbow, recipe) {
    if (!weaponIsCrossbow || excludedCrossbow || recipe.cnam !== weaponFormID) {
      return;
    }

    const bench = parseInt(this.statics.kwCraftingSmithingSharpeningWheel, 16);
    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
    if (recipe.bnam !== bench) {
      xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
    }

    xelib.RemoveElement(newRecipe, 'Conditions');
    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    updateHasPerkCondition(
      newRecipe,
      condition,
      10000000,
      1,
      this.statics.perkMarksmanshipBallistics
    );
  }

  modifyTemperingRecipe(weapon, weaponFormID, recipe) {
    const { bnam, cnam } = recipe;
    const bench = parseInt(this.statics.kwCraftingSmithingSharpeningWheel, 16);

    if (bnam !== bench || cnam !== weaponFormID) {
      return;
    }

    const perk = this.temperingPerkFromKeyword(weapon);

    if (!perk) {
      return;
    }

    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
    const condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
  }

  temperingPerkFromKeyword(weapon) {
    const s = this.statics;
    const kwda = getKwda(weapon);

    // prettier-ignore
    const keywordPerkMap = [
      { kwda: s.kwWeapMaterialDaedric,        perk: s.perkSmithingDaedric   },
      { kwda: s.kwWeapMaterialDragonbone,     perk: s.perkSmithingDragon    },
      { kwda: s.kwWeapMaterialDraugr,         perk: s.perkSmithingSteel     },
      { kwda: s.kwWeapMaterialDraugrHoned,    perk: s.perkSmithingSteel     },
      { kwda: s.kwWeapMaterialDwarven,        perk: s.perkSmithingDwarven   },
      { kwda: s.kwWeapMaterialEbony,          perk: s.perkSmithingEbony     },
      { kwda: s.kwWeapMaterialElven,          perk: s.perkSmithingElven     },
      { kwda: s.kwWeapMaterialFalmer,         perk: s.perkSmithingAdvanced  },
      { kwda: s.kwWeapMaterialGlass,          perk: s.perkSmithingGlass     },
      { kwda: s.kwWeapMaterialImperial,       perk: s.perkSmithingSteel     },
      { kwda: s.kwWeapMaterialOrcish,         perk: s.perkSmithingOrcish    },
      { kwda: s.kwWeapMaterialSteel,          perk: s.perkSmithingSteel     },
      { kwda: s.kwWeapMaterialSilver,         perk: s.perkSmithingSilver    },
      { kwda: s.kwWeapMaterialSilverRefined,  perk: s.perkSmithingSilver    },
      { kwda: s.kwWeapMaterialNordic,         perk: s.perkSmithingAdvanced  }
    ];

    let perk;
    keywordPerkMap.some(e => {
      if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        return false;
      }

      ({ perk } = e);
      return true;
    });

    if (!perk && !kwda(s.kwWeapMaterialIron) && !kwda(s.kwWeapMaterialWood)) {
      this.log(weapon, `Couldn't determine material - tempering recipe not modified.`);
    }

    return perk;
  }

  processCrossbow(weapon) {
    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow)) {
      return;
    }
    if (this.rules.excludedCrossbows.find(e => this.names[weapon].includes(e))) {
      return;
    }

    xelib.AddElementValue(weapon, 'DESC', 'Ignores 50% armor.');

    let requiredPerks = [];
    let secondaryIngredients = [];

    let newName = `Recurve ${this.names[weapon]}`;
    const newRecurveCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveCrossbow, 'FULL', newName);
    this.names[newRecurveCrossbow] = newName;
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

    newName = `Arbalest ${this.names[weapon]}`;
    const newArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newArbalestCrossbow, 'FULL', newName);
    this.names[newArbalestCrossbow] = newName;
    this.applyArbalestCrossbowChanges(newArbalestCrossbow);
    addPerkScript(
      newArbalestCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowArbalest
    );
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

    newName = `Lightweight ${this.names[weapon]}`;
    const newLightweightCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newLightweightCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newLightweightCrossbow, 'FULL', newName);
    this.names[newLightweightCrossbow] = newName;
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

    newName = `Silenced ${this.names[weapon]}`;
    const newSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newSilencedCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newSilencedCrossbow, 'FULL', newName);
    this.names[newSilencedCrossbow] = newName;
    this.applySilencedCrossbowChanges(newSilencedCrossbow);
    addPerkScript(
      newSilencedCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowSilenced
    );
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

    newName = `Recurve Arbalest ${this.names[weapon]}`;
    const newRecurveArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveArbalestCrossbow, 'FULL', newName);
    this.names[newRecurveArbalestCrossbow] = newName;
    this.applyRecurveCrossbowChanges(newRecurveArbalestCrossbow);
    this.applyArbalestCrossbowChanges(newRecurveArbalestCrossbow);
    addPerkScript(
      newArbalestCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowArbalest
    );
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

    newName = `Recurve Lightweight ${this.names[weapon]}`;
    const newRecurveLightweightCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveLightweightCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveLightweightCrossbow, 'FULL', newName);
    this.names[newRecurveLightweightCrossbow] = newName;
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

    newName = `Recurve Silenced ${this.names[weapon]}`;
    const newRecurveSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRecurveSilencedCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRecurveSilencedCrossbow, 'FULL', newName);
    this.names[newRecurveSilencedCrossbow] = newName;
    this.applyRecurveCrossbowChanges(newRecurveSilencedCrossbow);
    this.applySilencedCrossbowChanges(newRecurveSilencedCrossbow);
    addPerkScript(
      newRecurveSilencedCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowSilenced
    );
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

    newName = `Lightweight Arbalest ${this.names[weapon]}`;
    const newLightweightArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newLightweightArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newLightweightArbalestCrossbow, 'FULL', newName);
    this.names[newLightweightArbalestCrossbow] = newName;
    this.applyArbalestCrossbowChanges(newLightweightArbalestCrossbow);
    this.applyLightweightCrossbowChanges(newLightweightArbalestCrossbow);
    addPerkScript(
      newLightweightArbalestCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowArbalest
    );
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

    newName = `Silenced Arbalest ${this.names[weapon]}`;
    const newSilencedArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newSilencedArbalestCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newSilencedArbalestCrossbow, 'FULL', newName);
    this.names[newSilencedArbalestCrossbow] = newName;
    this.applyArbalestCrossbowChanges(newSilencedArbalestCrossbow);
    this.applySilencedCrossbowChanges(newSilencedArbalestCrossbow);
    addPerkScript(
      newSilencedArbalestCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowArbalestSilenced
    );
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

    newName = `Lightweight Silenced ${this.names[weapon]}`;
    const newLightweightSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newLightweightSilencedCrossbow, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newLightweightSilencedCrossbow, 'FULL', newName);
    this.names[newLightweightSilencedCrossbow] = newName;
    this.applyLightweightCrossbowChanges(newLightweightSilencedCrossbow);
    this.applySilencedCrossbowChanges(newLightweightSilencedCrossbow);
    addPerkScript(
      newLightweightSilencedCrossbow,
      'xxxAddPerkWhileEquipped',
      'p',
      this.statics.perkWeaponCrossbowSilenced
    );
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

    addPerkScript(weapon, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbow);
  }

  applyRecurveCrossbowChanges(weapon) {
    const baseDamage = this.getBaseDamage(weapon);
    const materialDamage = this.getWeaponMaterialDamageModifier(weapon);
    const typeDamage = this.getWeaponTypeDamageModifier(weapon);
    const recurveDamage = this.baseStats.damageBonuses.recurveCrossbow;
    const modifier = this.getKeywordWeaponDamageModifier(weapon);
    const desc = xelib.GetValue(weapon, 'DESC');
    let damage = (baseDamage + materialDamage + typeDamage + recurveDamage) * modifier;

    if (damage < 0) {
      damage = 0;
    }

    if (baseDamage === null || materialDamage === null || typeDamage === null) {
      this.log(weapon, `Base: ${baseDamage} Material: ${materialDamage} Type: ${typeDamage}`);
    }

    xelib.SetUIntValue(weapon, 'DATA\\Damage', damage);
    xelib.AddElementValue(weapon, 'DESC', `${desc} Deals additional damage.`);
  }

  applyArbalestCrossbowChanges(weapon) {
    const speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
    const weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetFloatValue(
      weapon,
      'DNAM\\Speed',
      speed + this.baseStats.speedBonuses.arbalestCrossbow
    );
    xelib.SetFloatValue(
      weapon,
      'DATA\\Weight',
      weight + this.baseStats.weightMultipliers.arbalestCrossbow
    );
    xelib.AddElementValue(
      weapon,
      'DESC',
      `${desc} Deals double damage against blocking enemies but fires slower.`
    );
  }

  applyLightweightCrossbowChanges(weapon) {
    const speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
    const weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetFloatValue(
      weapon,
      'DNAM\\Speed',
      speed + this.baseStats.speedBonuses.lightweightCrossbow
    );
    xelib.SetFloatValue(
      weapon,
      'DATA\\Weight',
      weight + this.baseStats.weightMultipliers.lightweightCrossbow
    );
    xelib.AddElementValue(weapon, 'DESC', `${desc} Has increased attack speed.`);
  }

  applySilencedCrossbowChanges(weapon) {
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.AddElementValue(weapon, 'DESC', `${desc} Deals increased sneak attack damage.`);
  }

  processSilverWeapon(weapon) {
    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapMaterialSilver)) {
      return;
    }

    const newName = `Refined ${this.names[weapon]}`;
    const desc = 'These supreme weapons set undead enemies ablaze, dealing extra damage.';
    const newRefinedSilverWeapon = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRefinedSilverWeapon, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRefinedSilverWeapon, 'FULL', newName);
    this.names[newRefinedSilverWeapon] = newName;
    xelib.AddElementValue(newRefinedSilverWeapon, 'DESC', desc);
    xelib.AddElementValue(
      newRefinedSilverWeapon,
      'KWDA\\.',
      this.statics.kwWeapMaterialSilverRefined
    );
    this.patchWeaponDamage(newRefinedSilverWeapon);
    this.patchWeaponReach(newRefinedSilverWeapon);
    this.patchWeaponSpeed(newRefinedSilverWeapon);

    if (
      !xelib.HasElement(newRefinedSilverWeapon, 'VMAD') ||
      !xelib.HasScript(newRefinedSilverWeapon, 'SilverSwordScript')
    ) {
      const vmad = xelib.AddElement(weapon, 'VMAD');
      xelib.SetIntValue(vmad, 'Version', 5);
      xelib.SetIntValue(vmad, 'Object Format', 2);
      const script = xelib.AddElement(vmad, 'Scripts\\.');
      xelib.SetValue(script, 'scriptName', 'SilverSwordScript');
      const property = xelib.AddElement(script, 'Properties\\.');
      xelib.SetValue(property, 'propertyName', 'SilverPerk');
      xelib.SetValue(property, 'Type', 'Object');
      xelib.SetValue(
        property,
        'Value\\Object Union\\Object v2\\FormID',
        this.statics.perkWeaponSilverRefined
      );
    }

    this.addTemperingRecipe(newRefinedSilverWeapon);
    const ingredients = [
      this.statics.ingotGold,
      this.statics.ingotQuicksilver,
      xelib.GetHexFormID(newRefinedSilverWeapon)
    ];
    this.addCraftingRecipe(
      newRefinedSilverWeapon,
      [this.statics.perkSmithingSilverRefined],
      ingredients
    );
    this.addMeltdownRecipe(newRefinedSilverWeapon);
  }

  addTemperingRecipe(weapon) {
    let input;
    let perk;

    this.keywordTemperMap.some(e => {
      if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        return false;
      }

      ({ input, perk } = e);
      return true;
    });

    if (!input) {
      return;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_TEMPER_${this.names[weapon]}`);
    xelib.AddElement(newRecipe, 'Items');

    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', input);
    xelib.SetUIntValue(ingredient, 'CNTO\\Count', 1);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingSharpeningWheel);

    if (perk) {
      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    }
  }

  addMeltdownRecipe(weapon) {
    const s = this.statics;
    const kwda = getKwda(weapon);
    let outputQuantity = 1;
    let inputQuantity = 1;
    let input;
    let perk;

    if (
      kwda(s.kwWeapTypeBattleaxe) ||
      kwda(s.kwWeapTypeGreatsword) ||
      kwda(s.kwWeapTypeWarhammer) ||
      kwda(s.kwWeapTypeBow)
    ) {
      outputQuantity += 1;
    } else if (kwda(s.kwWeapTypeDagger)) {
      inputQuantity += 1;
    }

    this.keywordTemperMap.some(e => {
      if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        return false;
      }

      if (
        e.kwda === s.kwWeapMaterialDaedric ||
        e.kwda === s.kwWeapMaterialDraugr ||
        e.kwda === s.kwWeapMaterialDraugrHoned
      ) {
        return false;
      }

      ({ input, perk } = e);
      return true;
    });

    if (!input) {
      return;
    }

    if (kwda(s.kwWeapMaterialDaedric)) {
      outputQuantity += 1;
    } else if (kwda(s.kwWeapMaterialDraugr) || kwda(s.kwWeapMaterialDraugrHoned)) {
      inputQuantity += 1;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_TEMPER_${this.names[weapon]}`);
    xelib.AddElement(newRecipe, 'Items');

    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', input);
    xelib.SetUIntValue(ingredient, 'CNTO\\Count', inputQuantity);
    xelib.AddElementValue(newRecipe, 'NAM1', `${outputQuantity}`);
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmelter);

    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

    if (perk) {
      createHasPerkCondition(newRecipe, 10000000, 1, perk);
    }

    createGetItemCountCondition(newRecipe, 11000000, 1, weapon);
  }

  addCraftingRecipe(weapon, requiredPerks, secondaryIngredients) {
    let input;
    let perk;

    this.keywordTemperMap.some(e => {
      if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        return false;
      }

      ({ input, perk } = e);
      return true;
    });

    if (!input) {
      return;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_WEAPON_${this.names[weapon]}`);

    xelib.AddElement(newRecipe, 'Items');
    const baseItem = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(baseItem, 'CNTO\\Item', input);
    xelib.SetUIntValue(baseItem, 'CNTO\\Count', 2);

    secondaryIngredients.forEach(ingredient => {
      const secondaryItem = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(secondaryItem, 'CNTO\\Item', ingredient);
      xelib.SetUIntValue(secondaryItem, 'CNTO\\Count', 1);
    });

    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));

    xelib.AddElement(newRecipe, 'Conditions');

    requiredPerks.forEach((p, index) => {
      let condition;

      if (index === 0) {
        condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      } else {
        condition = xelib.AddElement(newRecipe, 'Conditions\\.');
      }

      updateHasPerkCondition(newRecipe, condition, 10000000, 1, p);
    });

    if (perk) {
      createHasPerkCondition(newRecipe, 10000000, 1, perk);
    }
  }

  createKeywordMaps() {
    const s = this.statics;

    // prettier-ignore
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

    // prettier-ignore
    this.skyreTypesMap = [
      { kwda: s.kwWeapTypeBastardSword,     name: 'Bastard'       },
      { kwda: s.kwWeapTypeBattlestaff,      name: 'Battlestaff'   },
      { kwda: s.kwWeapTypeClub,             name: 'Club'          },
      { kwda: s.kwWeapTypeCrossbow,         name: 'Crossbow'      },
      { kwda: s.kwWeapTypeGlaive,           name: 'Glaive'        },
      { kwda: s.kwWeapTypeHalberd,          name: 'Halberd'       },
      { kwda: s.kwWeapTypeHatchet,          name: 'Hatchet'       },
      { kwda: s.kwWeapTypeKatana,           name: 'Katana'        },
      { kwda: s.kwWeapTypeLongbow,          name: 'Longbow'       },
      { kwda: s.kwWeapTypeLongmace,         name: 'Longmace'      },
      { kwda: s.kwWeapTypeLongsword,        name: 'Longsword'     },
      { kwda: s.kwWeapTypeMaul,             name: 'Maul'          },
      { kwda: s.kwWeapTypeNodachi,          name: 'Nodachi'       },
      { kwda: s.kwWeapTypeSaber,            name: 'Saber'         },
      { kwda: s.kwWeapTypeScimitar,         name: 'Scimitar'      },
      { kwda: s.kwWeapTypeShortbow,         name: 'Shortbow'      },
      { kwda: s.kwWeapTypeShortspear,       name: 'Shortspear'    },
      { kwda: s.kwWeapTypeShortsword,       name: 'Shortsword'    },
      { kwda: s.kwWeapTypeTanto,            name: 'Tanto'         },
      { kwda: s.kwWeapTypeUnarmed,          name: 'Unarmed'       },
      { kwda: s.kwWeapTypeWakizashi,        name: 'Wakizashi'     },
      { kwda: s.kwWeapTypeYari,             name: 'Yari'          }
    ];

    // prettier-ignore
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

    // prettier-ignore
    this.keywordTemperMap = [
      { kwda: this.statics.kwWeapMaterialDaedric,       input: s.ingotEbony,          perk: s.perkSmithingDaedric   },
      { kwda: this.statics.kwWeapMaterialDragonbone,    input: s.dragonBone,          perk: s.perkSmithingDragon    },
      { kwda: this.statics.kwWeapMaterialDraugr,        input: s.ingotSteel,          perk: s.perkSmithingSteel     },
      { kwda: this.statics.kwWeapMaterialDraugrHoned,   input: s.ingotSteel,          perk: s.perkSmithinSteel      },
      { kwda: this.statics.kwWeapMaterialDwarven,       input: s.ingotDwarven,        perk: s.perkSmithingDwarven   },
      { kwda: this.statics.kwWeapMaterialEbony,         input: s.ingotEbony,          perk: s.perkSmithingEbony     },
      { kwda: this.statics.kwWeapMaterialElven,         input: s.ingotMoonstone,      perk: s.perkSmithingElven     },
      { kwda: this.statics.kwWeapMaterialFalmer,        input: s.ingotchaurusChitin,  perk: null                    },
      { kwda: this.statics.kwWeapMaterialFalmerHoned,   input: s.ingotchaurusChitin,  perk: null                    },
      { kwda: this.statics.kwWeapMaterialGlass,         input: s.ingotMalachite,      perk: s.perkSmithingGlass     },
      { kwda: this.statics.kwWeapMaterialImperial,      input: s.ingotSteel,          perk: s.perkSmithingSteel     },
      { kwda: this.statics.kwWeapMaterialIron,          input: s.ingotIron,           perk: null                    },
      { kwda: this.statics.kwWeapMaterialOrcish,        input: s.ingotOrichalcum,     perk: s.perkSmithingOrcish    },
      { kwda: this.statics.kwWeapMaterialSilver,        input: s.ingotSilver,         perk: s.perkSmithingSilver    },
      { kwda: this.statics.kwWeapMaterialSilverRefined, input: s.ingotSilver,         perk: s.perkSmithingSilver    },
      { kwda: this.statics.kwWeapMaterialSteel,         input: s.ingotSteel,          perk: s.perkSmithingSteel     },
      { kwda: this.statics.kwWeapMaterialWood,          input: s.ingotIron,           perk: null                    },
      { kwda: this.statics.kwWeapMaterialStalhrim,      input: s.oreStalhrim,         perk: s.perkSmithingAdvanced  },
      { kwda: this.statics.kwWeapMaterialNordic,        input: s.ingotQuicksilver,    perk: s.perkSmithingAdvanced  }
    ];
  }

  log(weapon, message) {
    const name = this.names[weapon];
    const formId = xelib.GetHexFormID(weapon);

    this.helpers.logMessage(`${name}(${formId}): ${message}`);
  }
}

export const defaultSettings = {
  baseStats: {
    damage: {
      bow: 22,
      crossbow: 30,
      oneHanded: 12,
      twoHanded: 23
    },
    damageBonuses: {
      recurveCrossbow: 8
    },
    speedBonuses: {
      arbalestCrossbow: -0.2,
      lightweightCrossbow: 0.25
    },
    weightMultipliers: {
      arbalestCrossbow: 1.25,
      lightweightCrossbow: 0.75
    }
  },
  enabled: true,
  modifiers: {
    weaponStrongerLow: 1.1,
    weaponStrongerMedium: 1.2,
    weaponStrongerHigh: 1.3,
    weaponWeakerLow: 0.9,
    weaponWeakerMedium: 0.8,
    weaponWeakerHigh: 0.7
  }
};
