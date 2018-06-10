import {
  addPerkScript,
  createGetItemCountCondition,
  createHasPerkCondition,
  getKwda,
  getValueFromName,
  overrideCraftingRecipes,
  updateHasPerkCondition
} from './helpers';

export default class ArmorPatcher {
  names = {};

  constructor(helpers, locals, patch, settings) {
    this.baseStats = settings.armor.baseStats;
    this.cobj = locals.cobj;
    this.helpers = helpers;
    this.locals = locals;
    this.patchFile = patch;
    this.rules = locals.rules.armor;
    this.settings = settings;
    this.s = locals.statics;

    if (this.settings.armor.enabled) {
      this.updateGameSettings();
    }
  }

  load = {
    filter: record => {
      if (!this.settings.armor.enabled) {
        return false;
      }

      if (xelib.HasElement(record, 'TNAM')) {
        return true;
      }

      if (!xelib.FullName(record) || !xelib.HasElement(record, 'KWDA')) {
        return false;
      }

      if (xelib.HasArrayItem(record, 'KWDA', '', this.s.kwVendorItemClothing)) {
        return true;
      }

      if (xelib.HasArrayItem(record, 'KWDA', '', this.s.kwJewelry)) {
        return false;
      }

      const keywords = [this.s.kwArmorHeavy, this.s.kwArmorLight, this.s.kwArmorSlotShield];
      if (!keywords.some(kwda => xelib.HasArrayItem(record, 'KWDA', '', kwda))) {
        return false;
      }

      return true;
    },

    signature: 'ARMO'
  };

  updateGameSettings() {
    let hexFormId = parseInt(this.s.gmstArmorScalingFactor, 16);
    const protectionPerArmorBaseRecord = xelib.GetRecord(0, hexFormId);
    const protectionPerArmor = xelib.CopyElement(protectionPerArmorBaseRecord, this.patchFile);
    xelib.SetFloatValue(
      protectionPerArmor,
      'DATA\\Float',
      this.settings.armor.baseStats.protectionPerArmor
    );

    hexFormId = parseInt(this.s.gmstMaxArmorRating, 16);
    const maxProtectionBaseRecord = xelib.GetRecord(0, hexFormId);
    const maxProtection = xelib.CopyElement(maxProtectionBaseRecord, this.patchFile);
    xelib.SetFloatValue(maxProtection, 'DATA\\Float', this.settings.armor.baseStats.maxProtection);
  }

  patch = armor => {
    this.names[armor] = xelib.FullName(armor);

    if (xelib.HasElement(armor, 'TNAM')) {
      this.patchShieldWeight(armor);
      return;
    } else if (
      xelib.HasElement(armor, 'KWDA') &&
      xelib.HasArrayItem(armor, 'KWDA', '', this.s.kwVendorItemClothing)
    ) {
      this.patchMasqueradeKeywords(armor);
      this.processClothing(armor);
      return;
    }

    this.overrideMaterialKeywords(armor);
    this.patchMasqueradeKeywords(armor);
    this.patchArmorRating(armor);
    this.patchShieldWeight(armor);
    this.modifyRecipes(armor);
    this.addMeltdownRecipe(armor);
  };

  patchShieldWeight(armor) {
    if (
      !xelib.HasElement(armor, 'KWDA') ||
      !xelib.HasArrayItem(armor, 'KWDA', '', this.s.kwArmorSlotShield)
    ) {
      return;
    }

    if (this.hasHeavyMaterialKeyword(armor)) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwArmorShieldHeavy);

      if (!this.names[armor].includes('Heavy Shield')) {
        this.names[armor] = this.names[armor].replace('Shield', 'Heavy Shield');
        xelib.AddElementValue(armor, 'FULL', this.names[armor]);
      }
    } else {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwArmorShieldLight);

      if (!this.names[armor].includes('Light Shield')) {
        this.names[armor] = this.names[armor].replace('Shield', 'Light Shield');
        xelib.AddElementValue(armor, 'FULL', this.names[armor]);
      }
    }
  }

  hasHeavyMaterialKeyword(armor) {
    const { s } = this;
    const kwda = getKwda(armor);
    return (
      kwda(s.kwArmorMaterialBlades) ||
      kwda(s.kwArmorMaterialDraugr) ||
      kwda(s.kwArmorMaterialIron) ||
      kwda(s.kwArmorMaterialDwarven) ||
      kwda(s.kwArmorMaterialOrcish) ||
      kwda(s.kwArmorMaterialFalmer) ||
      kwda(s.kwArmorMaterialFalmerHeavyOriginal) ||
      kwda(s.kwArmorMaterialDaedric) ||
      kwda(s.kwArmorMaterialEbony) ||
      kwda(s.kwArmorMaterialDawnguard) ||
      kwda(s.kwArmorMaterialImperialHeavy) ||
      kwda(s.kwArmorMaterialSteel) ||
      kwda(s.kwArmorMaterialIronBanded) ||
      kwda(s.kwArmorMaterialDragonplate) ||
      kwda(s.kwArmorMaterialSteelPlate)
    );
  }

  patchMasqueradeKeywords(armor) {
    if (this.names[armor].includes('Thalmor')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwMasqueradeThalmor);
    }

    if (this.names[armor].includes('Bandit') || this.names[armor].includes('Fur')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwMasqueradeBandit);
    }

    if (this.names[armor].includes('Imperial')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwMasqueradeImperial);
    }

    if (this.names[armor].includes('Stormcloak')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwMasqueradeStormcloak);
    }

    if (this.names[armor].includes('Forsworn') || this.names[armor].includes('Old God')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.s.kwMasqueradeForsworn);
    }
  }

  processClothing(armor) {
    this.addClothingMeltdownRecipe(armor);

    if (this.rules.excludedDreamcloth.find(ed => this.names[armor].includes(ed))) {
      return;
    }

    if (xelib.HasElement(armor, 'EITM')) {
      return;
    }

    const dreamcloth = this.createDreamcloth(armor);
    if (!dreamcloth) {
      return;
    }

    this.addClothingCraftingRecipe(dreamcloth, true);
    this.addClothingMeltdownRecipe(dreamcloth, true);
  }

  createDreamcloth(armor) {
    const { s } = this;
    const kwda = getKwda(armor);
    let dreamclothPerk;

    if (kwda(s.kwClothingBody)) {
      dreamclothPerk = s.perkDreamclothBody;
    } else if (kwda(s.kwClothingHands)) {
      dreamclothPerk = s.perkDreamclothHands;
    } else if (kwda(s.kwClothingHead)) {
      dreamclothPerk = s.perkDreamclothHead;
    } else if (kwda(s.kwClothingFeet)) {
      dreamclothPerk = s.perkDreamclothFeet;
    }

    if (!dreamclothPerk) {
      return null;
    }

    const newName = `${this.names[armor]} [Dreamcloth]`;
    const newDreamcloth = xelib.CopyElement(armor, this.patchFile, true);
    xelib.AddElementValue(newDreamcloth, 'EDID', `REP_DREAMCLOTH_${newName}`);
    xelib.AddElementValue(newDreamcloth, 'FULL', newName);
    this.names[newDreamcloth] = newName;
    xelib.RemoveElement(newDreamcloth, 'EITM');
    xelib.RemoveElement(newDreamcloth, 'DESC');
    xelib.AddElementValue(newDreamcloth, 'KWDA\\.', s.kwArmorDreamcloth);

    addPerkScript(newDreamcloth, 'xxxDreamCloth', 'p', dreamclothPerk);

    return newDreamcloth;
  }

  addClothingMeltdownRecipe(armor, isDreamCloth) {
    const { s } = this;
    const kwda = getKwda(armor);
    let returnQuantity = 1;
    const inputQuantity = 1;

    if (kwda(s.kwClothingBody)) {
      returnQuantity += 2;
    } else if (kwda(s.kwClothingHands) || kwda(s.kwClothingHead) || kwda(s.kwClothingFeet)) {
      returnQuantity += 1;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_MELTDOWN_CLOTHING_${this.names[armor]}`);

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetUIntValue(ingredient, 'CNTO\\Count', inputQuantity);
    xelib.AddElementValue(newRecipe, 'NAM1', `${returnQuantity}`);
    xelib.AddElementValue(newRecipe, 'CNAM', s.leatherStrips);
    xelib.AddElementValue(newRecipe, 'BNAM', s.kwCraftingTanningRack);

    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

    if (isDreamCloth) {
      createHasPerkCondition(newRecipe, 10000000, 1, s.perkSmithingWeavingMill);
    }

    createGetItemCountCondition(newRecipe, 11000000, 1, armor);
  }

  addClothingCraftingRecipe(armor, isDreamCloth) {
    const { s } = this;
    const kwda = getKwda(armor);
    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_CLOTHING_${this.names[armor]}`);

    let quantityIngredient1 = 2;

    if (kwda(s.kwClothingBody)) {
      quantityIngredient1 += 2;
    } else if (kwda(s.kwClothingHead)) {
      quantityIngredient1 += 1;
    }

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.AddElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', s.leather);
    xelib.SetUIntValue(ingredient, 'CNTO\\Count', quantityIngredient1);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(armor));
    xelib.AddElementValue(newRecipe, 'BNAM', s.kwCraftingTanningRack);

    const secondaryIngredients = [];
    secondaryIngredients.push(s.leatherStrips);

    if (isDreamCloth) {
      secondaryIngredients.push(s.pettySoulGem);

      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.AddElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingWeavingMill);
    }

    secondaryIngredients.forEach(hexcode => {
      const ingr = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(ingr, 'CNTO\\Item', hexcode);
      xelib.SetUIntValue(ingr, 'CNTO\\Count', 1);
    });
  }

  overrideMaterialKeywords(armor) {
    const override = this.getArmorMaterialOverride(this.names[armor]);

    if (!override || this.hasMaterialKeyword(armor)) {
      return;
    }

    // prettier-ignore
    const overrideMap = {
      BONEMOLD_HEAVY: { kwda: this.s.kwArmorMaterialNordicLight,    perk: this.s.perkSmithingAdvanced },
      DAEDRIC:        { kwda: this.s.kwArmorMaterialDaedric,        perk: this.s.perkSmithingDaedric  },
      DRAGONPLATE:    { kwda: this.s.kwArmorMaterialDragonPlate,    perk: this.s.perkSmithingDragon   },
      DRAGONSCALE:    { kwda: this.s.kwArmorMaterialDragonscale,    perk: this.s.perkSmithingDragon   },
      DWARVEN:        { kwda: this.s.kwArmorMaterialDwarven,        perk: this.s.perkSmithingDwarven  },
      EBONY:          { kwda: this.s.kwArmorMaterialEbony,          perk: this.s.perkSmithingEbony    },
      ELVEN:          { kwda: this.s.kwArmorMaterialElven,          perk: this.s.perkSmithingElven    },
      FALMER:         { kwda: this.s.kwArmorMaterialFalmer,         perk: this.s.perkSmithingAdvanced },
      FUR:            { kwda: this.s.kwArmorMaterialFur,            perk: null                        },
      GLASS:          { kwda: this.s.kwArmorMaterialGlass,          perk: this.s.perkSmithingGlass    },
      HIDE:           { kwda: this.s.kwArmorMaterialHide,           perk: null                        },
      IRON:           { kwda: this.s.kwArmorMaterialIron,           perk: null                        },
      LEATHER:        { kwda: this.s.kwArmorMaterialLeather,        perk: this.s.perkSmithingLeather  },
      NORDIC_HEAVY:   { kwda: this.s.kwArmorMaterialNordicHeavy,    perk: this.s.perkSmithingAdvanced },
      ORCISH:         { kwda: this.s.kwArmorMaterialOrcish,         perk: this.s.perkSmithingOrcish   },
      SCALED:         { kwda: this.s.kwArmorMaterialScaled,         perk: this.s.perkSmithingAdvanced },
      STALHRIM_HEAVY: { kwda: this.s.kwArmorMaterialStalhrimHeavy,  perk: this.s.perkSmithingAdvanced },
      STALHRIM_LIGHT: { kwda: this.s.kwArmorMaterialStalhrimLight,  perk: this.s.perkSmithingAdvanced },
      STEEL:          { kwda: this.s.kwArmorMaterialSteel,          perk: this.s.perkSmithingSteel    },
      STEELPLATE:     { kwda: this.s.kwArmorMaterialSteelPlate,     perk: this.s.perkSmithingAdvanced }
    };

    if (overrideMap[override]) {
      xelib.AddElementValue(armor, 'KWDA\\.', overrideMap[override].kwda);
      overrideCraftingRecipes(this.cobj, armor, overrideMap[override].perk, this.patchFile);
    }
  }

  getArmorMaterialOverride(name) {
    const override = this.rules.materialOverrides.find(o => name.includes(o.substring));
    return override ? override.material : null;
  }

  hasMaterialKeyword(armor) {
    const { s } = this;
    const kwda = getKwda(armor);
    return (
      kwda(s.kwArmorMaterialDaedric) ||
      kwda(s.kwArmorMaterialSteel) ||
      kwda(s.kwArmorMaterialIron) ||
      kwda(s.kwArmorMaterialDwarven) ||
      kwda(s.kwArmorMaterialFalmer) ||
      kwda(s.kwArmorMaterialOrcish) ||
      kwda(s.kwArmorMaterialEbony) ||
      kwda(s.kwArmorMaterialSteelPlate) ||
      kwda(s.kwArmorMaterialDragonplate) ||
      kwda(s.kwArmorMaterialForsworn) ||
      kwda(s.kwArmorMaterialFur) ||
      kwda(s.kwArmorMaterialHide) ||
      kwda(s.kwArmorMaterialLeather) ||
      kwda(s.kwArmorMaterialElven) ||
      kwda(s.kwArmorMaterialScaled) ||
      kwda(s.kwArmorMaterialGlass) ||
      kwda(s.kwArmorMaterialDragonscale) ||
      kwda(s.kwArmorMaterialNordicHeavy) ||
      kwda(s.kwArmorMaterialStalhrimHeavy) ||
      kwda(s.kwArmorMaterialStalhrimLight) ||
      kwda(s.kwArmorMaterialBonemoldHeavy)
    );
  }

  patchArmorRating(armor) {
    const rating = Math.floor(
      this.getArmorSlotMultiplier(armor) * this.getMaterialArmorModifier(armor)
    );
    xelib.SetValue(armor, 'DNAM', `${rating}`);
  }

  getArmorSlotMultiplier(armor) {
    const kwda = getKwda(armor);
    if (kwda(this.s.kwArmorSlotBoots)) {
      return this.settings.armor.baseStats.multipliers.boots;
    }
    if (kwda(this.s.kwArmorSlotCuirass)) {
      return this.settings.armor.baseStats.multipliers.cuirass;
    }
    if (kwda(this.s.kwArmorSlotGauntlets)) {
      return this.settings.armor.baseStats.multipliers.gauntlets;
    }
    if (kwda(this.s.kwArmorSlotHelmet)) {
      return this.settings.armor.baseStats.multipliers.helmet;
    }
    if (kwda(this.s.kwArmorSlotShield)) {
      return this.settings.armor.baseStats.multipliers.shield;
    }

    return 0;
  }

  getMaterialArmorModifier(armor) {
    let armorRating = getValueFromName(this.rules.materials, this.names[armor], 'name', 'armor');

    if (armorRating !== null) {
      return armorRating;
    }

    const { s } = this;

    // prettier-ignore
    const keywordMaterialMap = [
      { kwda: s.kwArmorMaterialBlades,           name: 'Blades'          },
      { kwda: s.kwArmorMaterialBonemoldHeavy,    name: 'Bonemold'        },
      { kwda: s.kwArmorMaterialDarkBrotherhood,  name: 'Shrouded'        },
      { kwda: s.kwArmorMaterialDaedric,          name: 'Daedric'         },
      { kwda: s.kwArmorMaterialDawnguard,        name: 'Dawnguard Light' },
      { kwda: s.kwArmorMaterialDragonplate,      name: 'Dragonplate'     },
      { kwda: s.kwArmorMaterialDragonscale,      name: 'Dragonscale'     },
      { kwda: s.kwArmorMaterialDraugr,           name: 'Ancient Nord'    },
      { kwda: s.kwArmorMaterialDwarven,          name: 'Dwarven'         },
      { kwda: s.kwArmorMaterialEbony,            name: 'Ebony'           },
      { kwda: s.kwArmorMaterialElven,            name: 'Elven'           },
      { kwda: s.kwArmorMaterialElvenGilded,      name: 'Elven Gilded'    },
      { kwda: s.kwArmorMaterialFalmer,           name: 'Falmer'          },
      { kwda: s.kwArmorMaterialFalmerHardened,   name: 'Falmer Hardened' },
      { kwda: s.kwArmorMaterialFalmerHeavy,      name: 'Falmer Heavy'    },
      { kwda: s.kwArmorMaterialForsworn,         name: 'Forsworn'        },
      { kwda: s.kwArmorMaterialFur,              name: 'Fur'             },
      { kwda: s.kwArmorMaterialGlass,            name: 'Glass'           },
      { kwda: s.kwArmorMaterialHide,             name: 'Hide'            },
      { kwda: s.kwArmorMaterialHunter,           name: 'Dawnguard Heavy' },
      { kwda: s.kwArmorMaterialImperialHeavy,    name: 'Imperial Heavy'  },
      { kwda: s.kwArmorMaterialImperialLight,    name: 'Imperial Light'  },
      { kwda: s.kwArmorMaterialImperialStudded,  name: 'Studded Imperial'},
      { kwda: s.kwArmorMaterialIron,             name: 'Iron'            },
      { kwda: s.kwArmorMaterialIronBanded,       name: 'Iron Banded'     },
      { kwda: s.kwArmorMaterialLeather,          name: 'Leather'         },
      { kwda: s.kwArmorMaterialNightingale,      name: 'Nightingale'     },
      { kwda: s.kwArmorMaterialNordicHeavy,      name: 'Nordic'          },
      { kwda: s.kwArmorMaterialOrcish,           name: 'Orcish'          },
      { kwda: s.kwArmorMaterialScaled,           name: 'Scaled'          },
      { kwda: s.kwArmorMaterialStalhrimHeavy,    name: 'Stalhrim Heavy'  },
      { kwda: s.kwArmorMaterialStalhrimLight,    name: 'Stalhrim Light'  },
      { kwda: s.kwArmorMaterialSteel,            name: 'Steel'           },
      { kwda: s.kwArmorMaterialSteelPlate,       name: 'Steel Plate'     },
      { kwda: s.kwArmorMaterialStormcloak,       name: 'Stormcloak'      },
      { kwda: s.kwArmorMaterialStudded,          name: 'Studded'         },
      { kwda: s.kwArmorMaterialVampire,          name: 'Vampire'         }
    ];

    keywordMaterialMap.some(pair => {
      if (!xelib.HasArrayItem(armor, 'KWDA', '', pair.kwda)) {
        return false;
      }

      armorRating = getValueFromName(this.rules.materials, pair.name, 'name', 'armor');
      return true;
    });

    if (armorRating !== null) {
      return armorRating;
    }

    return 0;
  }

  modifyRecipes(armor) {
    const armorFormID = xelib.GetFormID(armor);
    const armorHasLeatherKwda = xelib.HasArrayItem(
      armor,
      'KWDA',
      '',
      this.s.kwArmorMaterialLeather
    );

    this.cobj.forEach(recipe => {
      this.modifyTemperingRecipe(armor, armorFormID, recipe);
      this.modifyLeatherCraftingRecipe(armor, armorFormID, armorHasLeatherKwda, recipe);
    });
  }

  modifyTemperingRecipe(armor, armorFormID, recipe) {
    const { bnam, cnam } = recipe;
    const bench = parseInt(this.s.kwCraftingSmithingArmorTable, 16);

    if (bnam !== bench || cnam !== armorFormID) {
      return;
    }

    const perk = this.temperingPerkFromKeyword(armor);

    if (!perk) {
      return;
    }

    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
    const condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
  }

  temperingPerkFromKeyword(armor) {
    const { s } = this;
    const kwda = getKwda(armor);
    let perk;

    if (kwda(s.kwArmorMaterialDaedric)) {
      perk = s.perkSmithingDaedric;
    } else if (kwda(s.kwArmorMaterialDragonplate) || kwda(s.kwArmorMaterialDragonscale)) {
      perk = s.perkSmithingDragon;
    } else if (kwda(s.kwArmorMaterialDraugr)) {
      perk = s.perkSmithingSteel;
    } else if (kwda(s.kwArmorMaterialDwarven)) {
      perk = s.perkSmithingDwarven;
    } else if (kwda(s.kwArmorMaterialEbony)) {
      perk = s.perkSmithingEbony;
    } else if (kwda(s.kwArmorMaterialElven) || kwda(s.kwArmorMaterialElvenGilded)) {
      perk = s.perkSmithingElven;
    } else if (
      kwda(s.kwArmorMaterialFalmer) ||
      kwda(s.kwArmorMaterialFalmerHardened) ||
      kwda(s.kwArmorMaterialFalmerHeavy) ||
      kwda(s.kwArmorMaterialFalmerHeavyOriginal)
    ) {
      perk = s.perkSmithingAdvanced;
    } else if (kwda(s.kwArmorMaterialGlass)) {
      perk = s.perkSmithingGlass;
    } else if (
      kwda(s.kwArmorMaterialImperialLight) ||
      kwda(s.kwArmorMaterialImperialStudded) ||
      kwda(s.kwArmorMaterialDawnguard) ||
      kwda(s.kwArmorMaterialHunter)
    ) {
      perk = s.perkSmithingSteel;
    } else if (
      !kwda(s.kwWeapMaterialIron) &&
      !kwda(s.kwMasqueradeStormcloak) &&
      !kwda(s.kwArmorMaterialIronBanded)
    ) {
      if (kwda(s.kwArmorMaterialOrcish)) {
        perk = s.perkSmithingOrcish;
      } else if (kwda(s.kwArmorMaterialBlades)) {
        perk = s.perkSmithingSteel;
      } else if (kwda(s.kwArmorMaterialSteel)) {
        perk = s.perkSmithingSteel;
      } else if (
        kwda(s.kwArmorMaterialLeather) ||
        kwda(s.kwArmorMaterialNightingale) ||
        kwda(s.kwArmorMaterialDarkBrotherhood)
      ) {
        perk = s.perkSmithingLeather;
      } else if (!kwda(s.kwArmorMaterialHide) && !kwda(s.kwArmorMaterialFur)) {
        if (
          kwda(s.kwArmorMaterialSteelPlate) ||
          kwda(s.kwArmorMaterialScaled) ||
          kwda(s.kwArmorMaterialStalhrimLight) ||
          kwda(s.kwArmorMaterialStalhrimHeavy) ||
          kwda(s.kwArmorMaterialBonemoldHeavy) ||
          kwda(s.kwArmorMaterialNordicHeavy)
        ) {
          perk = s.perkSmithingAdvanced;
        }
      }
    }

    return perk;
  }

  modifyLeatherCraftingRecipe(armor, armorFormID, armorHasLeatherKwda, recipe) {
    if (!armorHasLeatherKwda || recipe.cnam !== armorFormID) {
      return;
    }

    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
    createHasPerkCondition(newRecipe, 10000000, 1, this.s.perkSmithingLeather);
  }

  addMeltdownRecipe(armor) {
    const { s } = this;
    const kwda = getKwda(armor);
    const incr = v => v + 1;
    const noop = v => v;

    // prettier-ignore
    const keywordMap = [
      { kwda: s.kwArmorMaterialBlades,          cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialBonemoldHeavy,   cnam: s.netchLeather,     perk: s.perkSmithingAdvanced, bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialDaedric,         cnam: s.ingotEbony,       perk: s.perkSmithingDaedric,  bnam: s.kwCraftingSmelter    , func: incr  },
      { kwda: s.kwArmorMaterialDarkBrotherhood, cnam: s.leatherStrips,    perk: s.perkSmithingLeather,  bnam: s.kwCraftingTanningRack, func: incr  },
      { kwda: s.kwArmorMaterialDawnguard,       cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialDragonplate,     cnam: s.dragonbone,       perk: s.perkSmithingDragon,   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialDragonscale,     cnam: s.dragonscale,      perk: s.perkSmithingDragon,   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialDwarven,         cnam: s.ingotDwarven,     perk: s.perkSmithingDwarven,  bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialEbony,           cnam: s.ingotEbony,       perk: s.perkSmithingEbony,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialElven,           cnam: s.ingotMoonstone,   perk: s.perkSmithingElven,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialElvenGilded,     cnam: s.ingotMoonstone,   perk: s.perkSmithingElven,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialFalmer,          cnam: s.chaurusChitin,    perk: null,                   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialFalmerHardened,  cnam: s.chaurusChitin,    perk: null,                   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialFalmerHeavy,     cnam: s.chaurusChitin,    perk: null,                   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialForsworn,        cnam: s.leatherStrips,    perk: null,                   bnam: s.kwCraftingTanningRack, func: noop  },
      { kwda: s.kwArmorMaterialFur,             cnam: s.leatherStrips,    perk: null,                   bnam: s.kwCraftingTanningRack, func: noop  },
      { kwda: s.kwArmorMaterialHide,            cnam: s.leatherStrips,    perk: null,                   bnam: s.kwCraftingTanningRack, func: noop  },
      { kwda: s.kwArmorMaterialGlass,           cnam: s.ingotMalachite,   perk: s.perkSmithingGlass,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialHunter,          cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialImperialHeavy,   cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialImperialLight,   cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialImperialStudded, cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialIron,            cnam: s.ingotIron,        perk: null,                   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialLeather,         cnam: s.leatherStrips,    perk: s.perkSmithingLeather,  bnam: s.kwCraftingTanningRack, func: incr  },
      { kwda: s.kwArmorMaterialNightingale,     cnam: s.leatherStrips,    perk: s.perkSmithingLeather,  bnam: s.kwCraftingTanningRack, func: incr  },
      { kwda: s.kwArmorMaterialNordicHeavy,     cnam: s.ingotQuicksilver, perk: s.perkSmithingAdvanced, bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialOrcish,          cnam: s.ingotOrichalcum,  perk: s.perkSmithingOrcish,   bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialScaled,          cnam: s.ingotCorundum,    perk: s.perkSmithingAdvanced, bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialStalhrimHeavy,   cnam: s.oreStalhrim,      perk: s.perkSmithingAdvanced, bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialStalhrimLight,   cnam: s.oreStalhrim,      perk: s.perkSmithingAdvanced, bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialSteel,           cnam: s.ingotSteel,       perk: s.perkSmithingSteel,    bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialSteelPlate,      cnam: s.ingotCorundum,    perk: s.perkSmithingAdvanced, bnam: s.kwCraftingSmelter    , func: noop  },
      { kwda: s.kwArmorMaterialStormcloak,      cnam: s.ingotIron,        perk: null,                   bnam: s.kwCraftingSmelter    , func: noop  }
    ];

    let outputQuantity = 1;
    let inputQuantity = 1;
    let cnam;
    let perk;
    let bnam;

    if (kwda(s.kwArmorSlotCuirass) || kwda(s.kwArmorSlotShield)) {
      outputQuantity += 1;
    }

    if (kwda(s.kwArmorMaterialDraugr)) {
      cnam = s.dragonScale;
      bnam = s.kwCraftingSmelter;
      perk = s.perkSmithingSteel;
      inputQuantity += 1;
    } else {
      keywordMap.some(e => {
        if (!kwda(e.kwda)) {
          return false;
        }

        ({ bnam, cnam, perk } = e);
        outputQuantity = e.func(outputQuantity);
        return true;
      });
    }

    if (!cnam) {
      return;
    }

    const recipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(recipe, 'EDID', `REP_MELTDOWN_${this.names[armor]}`);
    xelib.AddElementValue(recipe, 'BNAM', bnam);
    xelib.AddElementValue(recipe, 'CNAM', cnam);
    xelib.AddElementValue(recipe, 'NAM1', `${outputQuantity}`);

    xelib.AddElement(recipe, 'Items');
    const baseItem = xelib.GetElement(recipe, 'Items\\[0]');
    xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetUIntValue(baseItem, 'CNTO\\Count', inputQuantity);

    xelib.AddElement(recipe, 'Conditions');
    const condition = xelib.GetElement(recipe, 'Conditions\\[0]');
    updateHasPerkCondition(recipe, condition, 10000000, 1, this.s.perkSmithingMeltdown);

    if (perk) {
      createHasPerkCondition(recipe, 10000000, 1, perk);
    }

    createGetItemCountCondition(recipe, 11000000, 1.0, armor);
  }
}

export const defaultSettings = {
  baseStats: {
    maxProtection: 95,
    multipliers: {
      boots: 1,
      cuirass: 3,
      gauntlets: 1,
      helmet: 1.5,
      shield: 1.5
    },
    protectionPerArmor: 0.1
  },
  enabled: true
};
