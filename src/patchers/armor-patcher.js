import * as h from './helpers';

export default class ArmorPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  // eslint-disable-next-line no-unused-vars
  load(plugin, helpers, settings, locals) {
    if (!settings.patchArmor) {
      return false;
    }

    this.settings = settings;
    this.patchFile = locals.patch;
    this.armor = locals.rules.armor;
    this.statics = locals.statics;
    this.cobj = locals.cobj;

    this.updateGameSettings();

    return {
      signature: 'ARMO',
      filter: (record) => {
        const armor = xelib.GetWinningOverride(record);

        if (xelib.HasElement(armor, 'TNAM')) { return true; }
        if (!xelib.FullName(armor) || !xelib.HasElement(armor, 'KWDA')) { return false; }
        if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwVendorItemClothing)) { return true; }
        if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwJewelry)) { return false; }

        if (!(xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorHeavy) ||
              xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorLight) ||
              xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotShield))) {
          return false;
        }

        return true;
      }
    }
  }

  updateGameSettings() {
    const fArmorScalingFactorBaseRecord = xelib.GetRecord(0, parseInt(this.statics.gmstfArmorScalingFactor, 16));
    const fArmorScalingFactor = xelib.CopyElement(fArmorScalingFactorBaseRecord, this.patchFile);
    xelib.SetFloatValue(fArmorScalingFactor, 'DATA\\Float', this.settings.armorBaseStats.fProtectionPerArmor);

    const fMaxArmorRatingBaseRecord = xelib.GetRecord(0, parseInt(this.statics.gmstfMaxArmorRating, 16));
    const fMaxArmorRating = xelib.CopyElement(fMaxArmorRatingBaseRecord, this.patchFile);
    xelib.SetFloatValue(fMaxArmorRating, 'DATA\\Float', this.settings.armorBaseStats.fMaxProtection);
  }

  // eslint-disable-next-line no-unused-vars
  patch(armor, helpers, settings, locals) {
    if (xelib.HasElement(armor, 'TNAM')) {
      this.patchShieldWeight(armor);
      return;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwVendorItemClothing)) {
      this.patchMasqueradeKeywords(armor);
      this.processClothing(armor);
      return;
    }

    this.overrideMaterialKeywords(armor);
    this.patchMasqueradeKeywords(armor);
    this.patchArmorRating(armor);
    this.patchShieldWeight(armor);
    this.modifyTemperingRecipe(armor);
    this.addMeltdownRecipe(armor);
    this.modifyLeatherCraftingRecipe(armor);
  }

  patchShieldWeight(armor) {
    const name = xelib.FullName(armor);

    if (!xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotShield)) {
      return;
    }

    if (this.hasHeavyMaterialKeyword(armor)) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwArmorShieldHeavy);

      if (!name.includes('Heavy Shield')) {
        xelib.AddElementValue(armor, 'FULL', name.replace('Shield', 'Heavy Shield'));
      }
    } else {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwArmorShieldLight);

      if (!name.includes('Light Shield')) {
        xelib.AddElementValue(armor, 'FULL', name.replace('Shield', 'Light Shield'));
      }
    }
  }

  hasHeavyMaterialKeyword(armor) {
    const kwda = h.getKwda(armor);
    return kwda(this.statics.kwArmorMaterialBlades) ||
           kwda(this.statics.kwArmorMaterialDraugr) ||
           kwda(this.statics.kwArmorMaterialIron) ||
           kwda(this.statics.kwArmorMaterialDwarven) ||
           kwda(this.statics.kwArmorMaterialOrcish) ||
           kwda(this.statics.kwArmorMaterialFalmer) ||
           kwda(this.statics.kwArmorMaterialFalmerHeavyOriginal) ||
           kwda(this.statics.kwArmorMaterialDaedric) ||
           kwda(this.statics.kwArmorMaterialEbony) ||
           kwda(this.statics.kwArmorMaterialDawnguard) ||
           kwda(this.statics.kwArmorMaterialImperialHeavy) ||
           kwda(this.statics.kwArmorMaterialSteel) ||
           kwda(this.statics.kwArmorMaterialIronBanded) ||
           kwda(this.statics.kwArmorMaterialDragonplate) ||
           kwda(this.statics.kwArmorMaterialSteelPlate);
  }

  patchMasqueradeKeywords(armor) {
    const name = xelib.FullName(armor);

    if (name.includes('Thalmor')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeThalmor);
    }

    if (name.includes('Bandit') || name.includes('Fur')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeBandit);
    }

    if (name.includes('Imperial')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeImperial);
    }

    if (name.includes('Stormcloak')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeStormcloak);
    }

    if (name.includes('Forsworn') || name.includes('Old God')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeForsworn);
    }
  }

  processClothing(armor) {
    const name = xelib.FullName(armor);

    this.addClothingMeltdownRecipe(armor);

    if (name.includes('Dreamcloth')) { return; }

    if (xelib.HasElement(armor, 'EITM')) { return; }

    const dreamcloth = this.createDreamcloth(armor);
    if (!dreamcloth) { return; }

    this.addClothingCraftingRecipe(dreamcloth, true);
    this.addClothingMeltdownRecipe(dreamcloth, true);
  }

  createDreamcloth(armor) {
    const name = xelib.FullName(armor);
    let dreamclothPerk;

    if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwClothingBody)) {
      dreamclothPerk = this.statics.perkDreamclothBody;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwClothingHands)) {
      dreamclothPerk = this.statics.perkDreamclothHands;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwClothingHead)) {
      dreamclothPerk = this.statics.perkDreamclothHead;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwClothingFeet)) {
      dreamclothPerk = this.statics.perkDreamclothFeet;
    } else {
      return null;
    }

    if (!dreamclothPerk) { return null; }

    const newName = `${name} [Dreamcloth]`;
    const newDreamcloth = xelib.CopyElement(armor, this.patchFile, true);
    xelib.AddElementValue(newDreamcloth, 'EDID', `REP_DREAMCLOTH_${newName}`);
    xelib.AddElementValue(newDreamcloth, 'FULL', newName);
    xelib.RemoveElement(newDreamcloth, 'EITM');
    xelib.RemoveElement(newDreamcloth, 'DESC');
    xelib.AddElementValue(newDreamcloth, 'KWDA\\.', this.statics.kwArmorDreamcloth);

    h.addPerkScript(newDreamcloth, 'xxxDreamCloth', 'p', dreamclothPerk);

    return newDreamcloth;
  }

  addClothingMeltdownRecipe(armor, isDreamCloth) {
    const s = this.statics;
    const kwda = h.getKwda(armor);
    const name = xelib.FullName(armor);
    let returnQuantity = 1;
    let inputQuantity = 1;

    if (kwda(s.kwClothingBody)) {
      returnQuantity = returnQuantity + 2;
    } else if (kwda(s.kwClothingHands) || kwda(s.kwClothingHead) || kwda(s.kwClothingFeet)) {
      returnQuantity + returnQuantity + 1;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_MELTDOWN_CLOTHING_${name}`);

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetIntValue(ingredient, 'CNTO\\Count', inputQuantity);
    xelib.AddElementValue(newRecipe, 'NAM1', `${returnQuantity}`);
    xelib.AddElementValue(newRecipe, 'CNAM', s.leatherStrips);
    xelib.AddElementValue(newRecipe, 'BNAM', s.kwCraftingTanningRack);

    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    h.updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

    if (isDreamCloth) {
      h.createHasPerkCondition(newRecipe, 10000000, 1, s.perkSmithingWeavingMill);
    }

    h.createGetItemCountCondition(newRecipe, 11000000, 1, armor);
  }

  addClothingCraftingRecipe(armor, isDreamCloth) {
    const s = this.statics;
    const kwda = h.getKwda(armor);
    const name = xelib.FullName(armor);
    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_CLOTHING_${name}`);

    let quantityIngredient1 = 2;

    if (kwda(s.kwClothingBody)) {
      quantityIngredient1 = quantityIngredient1 + 2;
    } else if (kwda(s.kwClothingHead)) {
      quantityIngredient1 = quantityIngredient1 + 1;
    }

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.AddElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', s.leather);
    xelib.SetIntValue(ingredient, 'CNTO\\Count', quantityIngredient1);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(armor));
    xelib.AddElementValue(newRecipe, 'BNAM', s.kwCraftingTanningRack);

    const secondaryIngredients = [];
    secondaryIngredients.push(s.leatherStrips);

    if (isDreamCloth) {
      secondaryIngredients.push(s.pettySoulGem);

      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.AddElement(newRecipe, 'Conditions\\[0]');
      h.updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingWeavingMill);
    }

    secondaryIngredients.forEach((hexcode) => {
      const ingredient = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(ingredient, 'CNTO\\Item', hexcode);
      xelib.SetIntValue(ingredient, 'CNTO\\Count', 1);
    });
  }

  overrideMaterialKeywords(armor) {
    const name = xelib.FullName(armor);
    const override = this.getArmorMaterialOverride(name);

    if (!override) { return; }

    if (this.hasMaterialKeyword(armor)) { return; }

    const overrideMap = {
      BONEMOLD_HEAVY: { kwda: this.statics.kwArmorMaterialNordicLight,    perk: this.statics.perkSmithingAdvanced },
      DAEDRIC:        { kwda: this.statics.kwArmorMaterialDaedric,        perk: this.statics.perkSmithingDaedric  },
      DRAGONPLATE:    { kwda: this.statics.kwArmorMaterialDragonPlate,    perk: this.statics.perkSmithingDragon   },
      DRAGONSCALE:    { kwda: this.statics.kwArmorMaterialDragonscale,    perk: this.statics.perkSmithingDragon   },
      DWARVEN:        { kwda: this.statics.kwArmorMaterialDwarven,        perk: this.statics.perkSmithingDwarven  },
      EBONY:          { kwda: this.statics.kwArmorMaterialEbony,          perk: this.statics.perkSmithingEbony    },
      ELVEN:          { kwda: this.statics.kwArmorMaterialElven,          perk: this.statics.perkSmithingElven    },
      FALMER:         { kwda: this.statics.kwArmorMaterialFalmer,         perk: this.statics.perkSmithingAdvanced },
      FUR:            { kwda: this.statics.kwArmorMaterialFur,            perk: null                              },
      GLASS:          { kwda: this.statics.kwArmorMaterialGlass,          perk: this.statics.perkSmithingGlass    },
      HIDE:           { kwda: this.statics.kwArmorMaterialHide,           perk: null                              },
      IRON:           { kwda: this.statics.kwArmorMaterialIron,           perk: null                              },
      LEATHER:        { kwda: this.statics.kwArmorMaterialLeather,        perk: this.statics.perkSmithingLeather  },
      NORDIC_HEAVY:   { kwda: this.statics.kwArmorMaterialNordicHeavy,    perk: this.statics.perkSmithingAdvanced },
      ORCISH:         { kwda: this.statics.kwArmorMaterialOrcish,         perk: this.statics.perkSmithingOrcish   },
      SCALED:         { kwda: this.statics.kwArmorMaterialScaled,         perk: this.statics.perkSmithingAdvanced },
      STALHRIM_HEAVY: { kwda: this.statics.kwArmorMaterialStalhrimHeavy,  perk: this.statics.perkSmithingAdvanced },
      STALHRIM_LIGHT: { kwda: this.statics.kwArmorMaterialStalhrimLight,  perk: this.statics.perkSmithingAdvanced },
      STEEL:          { kwda: this.statics.kwArmorMaterialSteel,          perk: this.statics.perkSmithingSteel    },
      STEELPLATE:     { kwda: this.statics.kwArmorMaterialSteelPlate,     perk: this.statics.perkSmithingAdvanced }
    };

    if (overrideMap[override]) {
      xelib.AddElementValue(armor, 'KWDA\\.', overrideMap[override].kwda);
      h.overrideCraftingRecipes(this.cobj, armor, overrideMap[override].perk, this.patchFile);
      return;
    }
  }

  getArmorMaterialOverride(name) {
    const override = this.armor.material_overrides.find((o) => name.includes(o.armorSubstring));
    return override ? override.materialOverride : null;
  }

  hasMaterialKeyword(armor) {
    return xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialDaedric) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialSteel) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialIron) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialDwarven) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialFalmer) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialOrcish) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialEbony) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialSteelPlate) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialDragonplate) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialFur) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialHide) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialLeather) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialElven) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialScaled) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialGlass) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialDragonscale) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialNordicHeavy) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialStalhrimHeavy) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialStalhrimLight) ||
           xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialBonemoldHeavy);
  }

  patchArmorRating(armor) {
    const rating = this.getArmorSlotMultiplier(armor) * this.getMaterialArmorModifier(armor);
    xelib.SetValue(armor, 'DNAM', `${rating}`);
  }

  getArmorSlotMultiplier(armor) {
    const kwda = h.getKwda(armor);
    if (kwda(this.statics.kwArmorSlotBoots)) { return this.settings.armorBaseStats.fArmorFactorBoots; }
    if (kwda(this.statics.kwArmorSlotCuirass)) { return this.settings.armorBaseStats.fArmorFactorCuirass; }
    if (kwda(this.statics.kwArmorSlotGauntlets)) { return this.settings.armorBaseStats.fArmorFactorGauntlets; }
    if (kwda(this.statics.kwArmorSlotHelmet)) { return this.settings.armorBaseStats.fArmorFactorHelmet; }
    if (kwda(this.statics.kwArmorSlotShield)) { return this.settings.armorBaseStats.fArmorFactorShield; }

    return 0;
  }

  getMaterialArmorModifier(armor) {
    const name = xelib.FullName(armor);
    let armorRating = h.getValueFromName(this.armor.materials, name, 'name', 'iArmor');

    if (armorRating !== null) { return armorRating; }

    const s = this.statics;
    const keywordMaterialMap = [
      { kwda: s.kwArmorMaterialBlades,           name: "Blades"          },
      { kwda: s.kwArmorMaterialBonemoldHeavy,    name: "Bonemold"        },
      { kwda: s.kwArmorMaterialDarkBrotherhood,  name: "Shrouded"        },
      { kwda: s.kwArmorMaterialDaedric,          name: "Daedric"         },
      { kwda: s.kwArmorMaterialDawnguard,        name: "Dawnguard Light" },
      { kwda: s.kwArmorMaterialDragonplate,      name: "Dragonplate"     },
      { kwda: s.kwArmorMaterialDragonscale,      name: "Dragonscale"     },
      { kwda: s.kwArmorMaterialDraugr,           name: "Ancient Nord"    },
      { kwda: s.kwArmorMaterialDwarven,          name: "Dwarven"         },
      { kwda: s.kwArmorMaterialEbony,            name: "Ebony"           },
      { kwda: s.kwArmorMaterialElven,            name: "Elven"           },
      { kwda: s.kwArmorMaterialElvenGilded,      name: "Elven Gilded"    },
      { kwda: s.kwArmorMaterialFalmer,           name: "Falmer"          },
      { kwda: s.kwArmorMaterialFalmerHardened,   name: "Falmer Hardened" },
      { kwda: s.kwArmorMaterialFalmerHeavy,      name: "Falmer Heavy"    },
      { kwda: s.kwArmorMaterialFur,              name: "Fur"             },
      { kwda: s.kwArmorMaterialGlass,            name: "Glass"           },
      { kwda: s.kwArmorMaterialHide,             name: "Hide"            },
      { kwda: s.kwArmorMaterialHunter,           name: "Dawnguard Heavy" },
      { kwda: s.kwArmorMaterialImperialHeavy,    name: "Imperial Heavy"  },
      { kwda: s.kwArmorMaterialImperialLight,    name: "Imperial Light"  },
      { kwda: s.kwArmorMaterialImperialStudded,  name: "Studded Imperial"},
      { kwda: s.kwArmorMaterialIron,             name: "Iron"            },
      { kwda: s.kwArmorMaterialIronBanded,       name: "Iron Banded"     },
      { kwda: s.kwArmorMaterialLeather,          name: "Leather"         },
      { kwda: s.kwArmorMaterialNightingale,      name: "Nightingale"     },
      { kwda: s.kwArmorMaterialNordicHeavy,      name: "Nordic"          },
      { kwda: s.kwArmorMaterialOrcish,           name: "Orcish"          },
      { kwda: s.kwArmorMaterialScaled,           name: "Scaled"          },
      { kwda: s.kwArmorMaterialStalhrimHeavy,    name: "Stalhrim Heavy"  },
      { kwda: s.kwArmorMaterialStalhrimLight,    name: "Stalhrim Light"  },
      { kwda: s.kwArmorMaterialSteel,            name: "Steel"           },
      { kwda: s.kwArmorMaterialSteelPlate,       name: "Steel Plate"     },
      { kwda: s.kwArmorMaterialStormcloak,       name: "Stormcloak"      },
      { kwda: s.kwArmorMaterialStudded,          name: "Studded"         },
      { kwda: s.kwArmorMaterialVampire,          name: "Vampire"         }
    ];

    keywordMaterialMap.some((pair) => {
      if (xelib.HasArrayItem(armor, 'KWDA', '', pair.kwda)) {
        armorRating = h.getValueFromName(this.armor.materials, pair.name, 'name', 'iArmor');
        return true;
      }
    });

    if (armorRating !== null) { return armorRating; }

    return 0;
  }

  modifyRecipes(armor) {
    this.cobj.forEach((recipe) => {
      this.modifyTemperingRecipe(armor, recipe);
      this.modifyLeatherCraftingRecipe(armor, recipe);
    });
  }

  modifyTemperingRecipe(armor, recipe) {
    const bnam = xelib.GetLinksTo(recipe, 'BNAM');
    const cnam = xelib.GetLinksTo(recipe, 'CNAM');
    const bench = xelib.GetRecord(0, parseInt(this.statics.kwCraftingSmithingArmorTable, 16));

    if (!cnam || !bnam || !xelib.ElementEquals(bnam, bench) || !xelib.ElementEquals(cnam, armor)) { return; }

    const perk = this.temperingPerkFromKeyword(armor);

    if (!perk) { return; }

    const newRecipe = xelib.CopyElement(recipe, this.patchFile);
    const condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
    h.updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
  }

  temperingPerkFromKeyword(armor) {
    const s = this.statics
    const kwda = h.getKwda(armor);
    let perk;

    if (kwda(s.kwArmorMaterialDaedric)) {
      perk = s.perkSmithingDaedric;
    } else if (kwda(s.kwArmorMaterialDragonPlate) || kwda(s.kwArmorMaterialDragonscale))  {
      perk = s.perkSmithingDragon;
    } else if (kwda(s.kwArmorMaterialDraugr)) {
      perk = s.perkSmithingSteel;
    } else if (kwda(s.kwArmorMaterialDwarven)) {
      perk = s.perkSmithingDwarven;
    } else if (kwda(s.kwArmorMaterialEbony)) {
      perk = s.perkSmithingEbony;
    } else if (kwda(s.kwArmorMaterialElven)  || kwda(s.kwArmorMaterialElvenGilded)) {
      perk = s.perkSmithingElven;
    } else if (kwda(s.kwArmorMaterialFalmer) || kwda(s.kwArmorMaterialFalmerHardened) ||
               kwda(s.kwArmorMaterialFalmerHeavy) || kwda(s.kwArmorMaterialFalmerHeavyOriginal)) {
      perk = s.perkSmithingAdvanced;
    } else if (kwda(s.kwArmorMaterialGlass)) {
      perk = s.perkSmithingGlass;
    } else if (kwda(s.kwArmorMaterialImperialLight) || kwda(s.kwArmorMaterialImperialStudded) ||
               kwda(s.kwArmorMaterialDawnguard) || kwda(s.kwArmorMaterialHunter)) {
      perk = s.perkSmithingSteel;
    } else if (!kwda(s.kwWeapMaterialIron) && !kwda(s.kwMasqueradeStormcloak) && !kwda(s.kwArmorMaterialIronBanded)) {
      if (kwda(s.kwArmorMaterialOrcish)) {
        perk = s.perkSmithingOrcish;
      } else if (kwda(s.kwArmorMaterialBlades)) {
        perk = s.perkSmithingSteel;
      } else if (kwda(s.kwArmorMaterialSteel)) {
        perk = s.perkSmithingSteel;
      } else if (kwda(s.kwArmorMaterialLeather) || kwda(s.kwArmorMaterialNightingale) || kwda(s.kwArmorMaterialDarkBrotherhood)) {
        perk = s.perkSmithingLeather;
      } else if (!kwda(s.kwArmorMaterialHide) && !kwda(s.kwArmorMaterialFur)) {
        if (kwda(s.kwArmorMaterialSteelPlate) || kwda(s.kwArmorMaterialScaled) || kwda(s.kwArmorMaterialStalhrimLight) ||
            kwda(s.kwArmorMaterialStalhrimHeavy) || kwda(s.kwArmorMaterialBonemoldHeavy) || kwda(s.kwArmorMaterialNordicHeavy)) {
          perk = s.perkSmithingAdvanced;
        }
      }
    }

    return perk;
  }

  modifyLeatherCraftingRecipe(armor, recipe) {
    if (!xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialLeather)) { return; }

    const cnam = xelib.GetLinksTo(recipe, 'CNAM');
    if (!cnam || !xelib.ElementEquals(cnam, armor)) { return; }

    const newRecipe = xelib.CopyElement(recipe, this.patchFile);
    h.createHasPerkCondition(newRecipe, 10000000, 1, this.statics.perkSmithingLeather);
  }

  addMeltdownRecipe(armor) {
    const s = this.statics;
    const name = xelib.FullName(armor);
    const kwda = function(kwda) { return xelib.HasArrayItem(armor, 'KWDA', '', kwda); };
    const incr = function(v) { return v + 1; };
    const noop = function(v) { return v; };
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

    if (kwda('ArmorCuirass') || kwda('ArmorShield')) {
      outputQuantity = outputQuantity + 1;
    }

    if (kwda(s.kwArmorMaterialDraugr)) {
      cnam = s.dragonScale;
      bnam = s.kwCraftingSmelter;
      perk = s.perkSmithingSteel;
      inputQuantity = inputQuantity + 1;
    } else {
      keywordMap.some((e) => {
        if (kwda(e.kwda)) {
          cnam = e.cnam;
          bnam = e.bnam;
          perk = e.perk;
          outputQuantity = e.func(outputQuantity);
          return true;
        }
      });
    }

    if (!cnam) { return; }

    const recipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(recipe, 'EDID', `REP_MELTDOWN_${name}`);
    xelib.AddElementValue(recipe, 'BNAM', bnam);
    xelib.AddElementValue(recipe, 'CNAM', cnam);
    xelib.AddElementValue(recipe, 'NAM1', `${outputQuantity}`);

    xelib.AddElement(recipe, 'Items');
    const baseItem = xelib.GetElement(recipe, 'Items\\[0]')
    xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetIntValue(baseItem, 'CNTO\\Count', inputQuantity);

    xelib.AddElement(recipe, 'Conditions');
    const condition = xelib.GetElement(recipe, 'Conditions\\[0]');
    h.updateHasPerkCondition(recipe, condition, 10000000, 1, this.statics.perkSmithingMeltdown);

    if (perk) {
      h.createHasPerkCondition(recipe, 10000000, 1, perk);
    }

    h.createGetItemCountCondition(recipe, 11000000, 1.0, armor);
  }
}
