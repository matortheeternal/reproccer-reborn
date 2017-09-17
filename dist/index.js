function overrideCraftingRecipes(cobj, armor, perk, patchFile) {
  const armorFormID = xelib.GetFormID(armor);

  cobj.forEach((recipe) => {
    if (!xelib.HasElement(recipe, 'CNAM')) { return; }
    const cnam = xelib.GetUIntValue(recipe, 'CNAM');

    if (cnam !== armorFormID) { return; }

    const newRecipe = xelib.CopyElement(recipe, patchFile);
    xelib.RemoveElement(newRecipe, 'Conditions');

    if (perk) {
      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(recipe, condition, 10000000, 1, perk);
    }
  });
}

function createHasPerkCondition(recipe, type, value, perk) {
  const condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateHasPerkCondition(recipe, condition, type, value, perk);
  return condition;
}

function updateHasPerkCondition(recipe, condition, type, value, perk) {
  xelib.SetIntValue(condition, 'CTDA\\Type', type);
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
  xelib.SetValue(condition, 'CTDA\\Perk', perk);
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}

function createGetItemCountCondition(recipe, type, value, object) {
  const condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateGetItemCountCondition(recipe, condition, type, value, object);
  return condition;
}

function updateGetItemCountCondition(recipe, condition, type, value, object) {
  xelib.SetIntValue(condition, 'CTDA\\Type', type);
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'GetItemCount');
  xelib.SetValue(condition, 'CTDA\\Inventory Object', xelib.GetHexFormID(object));
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}

function getValueFromName(collection, name, field1, field2) {
  let maxLength = 0;
  let value = null;

  collection.forEach((thing) => {
    if (name.includes(thing[field1]) && thing[field1].length > maxLength) {
      value = thing[field2];
      maxLength = thing[field1].length;
    }
  });

  return value;
}

function getKwda(handle) {
  return function(kwda) {
    return xelib.HasArrayItem(handle, 'KWDA', '', kwda);
  }
}



function addPerkScript(weapon, scriptName, propertyName, perk) {
  const vmad = xelib.AddElement(weapon, 'VMAD');
  xelib.SetIntValue(vmad, 'Version', 5);
  xelib.SetIntValue(vmad, 'Object Format', 2);
  const script = xelib.AddElement(vmad, 'Scripts\\.');
  xelib.SetValue(script, 'scriptName', scriptName);
  const property = xelib.AddElement(script, 'Properties\\.');
  xelib.SetValue(property, 'propertyName', propertyName);
  xelib.SetIntValue(property, 'Type', 1);
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', perk);
}

class ArmorPatcher {
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
    this.names = {};

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
    this.names[armor] = xelib.FullName(armor);

    if (xelib.HasElement(armor, 'TNAM')) {
      this.patchShieldWeight(armor);
      return;
    } else if (xelib.HasElement(armor, 'KWDA') && xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwVendorItemClothing)) {
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
  }

  patchShieldWeight(armor) {
    if (!xelib.HasElement(armor, 'KWDA') || !xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotShield)) {
      return;
    }

    if (this.hasHeavyMaterialKeyword(armor)) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwArmorShieldHeavy);

      if (!this.names[armor].includes('Heavy Shield')) {
        this.names[armor] = this.names[armor].replace('Shield', 'Heavy Shield');
        xelib.AddElementValue(armor, 'FULL', this.names[armor]);
      }
    } else {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwArmorShieldLight);

      if (!this.names[armor].includes('Light Shield')) {
        this.names[armor] = this.names[armor].replace('Shield', 'Light Shield');
        xelib.AddElementValue(armor, 'FULL', this.names[armor]);
      }
    }
  }

  hasHeavyMaterialKeyword(armor) {
    const s = this.statics;
    const kwda = getKwda(armor);
    return kwda(s.kwArmorMaterialBlades) || kwda(s.kwArmorMaterialDraugr) ||
           kwda(s.kwArmorMaterialIron) || kwda(s.kwArmorMaterialDwarven) ||
           kwda(s.kwArmorMaterialOrcish) || kwda(s.kwArmorMaterialFalmer) ||
           kwda(s.kwArmorMaterialFalmerHeavyOriginal) || kwda(s.kwArmorMaterialDaedric) ||
           kwda(s.kwArmorMaterialEbony) || kwda(s.kwArmorMaterialDawnguard) ||
           kwda(s.kwArmorMaterialImperialHeavy) || kwda(s.kwArmorMaterialSteel) ||
           kwda(s.kwArmorMaterialIronBanded) || kwda(s.kwArmorMaterialDragonplate) || kwda(s.kwArmorMaterialSteelPlate);
  }

  patchMasqueradeKeywords(armor) {
    if (this.names[armor].includes('Thalmor')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeThalmor);
    }

    if (this.names[armor].includes('Bandit') || this.names[armor].includes('Fur')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeBandit);
    }

    if (this.names[armor].includes('Imperial')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeImperial);
    }

    if (this.names[armor].includes('Stormcloak')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeStormcloak);
    }

    if (this.names[armor].includes('Forsworn') || this.names[armor].includes('Old God')) {
      xelib.AddElementValue(armor, 'KWDA\\.', this.statics.kwMasqueradeForsworn);
    }
  }

  processClothing(armor) {
    this.addClothingMeltdownRecipe(armor);

    if (this.armor.excludedDreamcloth.find((ed) => this.names[armor].includes(ed))) { return; }

    if (xelib.HasElement(armor, 'EITM')) { return; }

    const dreamcloth = this.createDreamcloth(armor);
    if (!dreamcloth) { return; }

    this.addClothingCraftingRecipe(dreamcloth, true);
    this.addClothingMeltdownRecipe(dreamcloth, true);
  }

  createDreamcloth(armor) {
    const s = this.statics;
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

    if (!dreamclothPerk) { return null; }

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
    const s = this.statics;
    const kwda = getKwda(armor);
    let returnQuantity = 1;
    let inputQuantity = 1;

    if (kwda(s.kwClothingBody)) {
      returnQuantity = returnQuantity + 2;
    } else if (kwda(s.kwClothingHands) || kwda(s.kwClothingHead) || kwda(s.kwClothingFeet)) {
      returnQuantity = returnQuantity + 1;
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_MELTDOWN_CLOTHING_${this.names[armor]}`);

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetIntValue(ingredient, 'CNTO\\Count', inputQuantity);
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
    const s = this.statics;
    const kwda = getKwda(armor);
    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_CLOTHING_${this.names[armor]}`);

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
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingWeavingMill);
    }

    secondaryIngredients.forEach((hexcode) => {
      const ingredient = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(ingredient, 'CNTO\\Item', hexcode);
      xelib.SetIntValue(ingredient, 'CNTO\\Count', 1);
    });
  }

  overrideMaterialKeywords(armor) {
    const override = this.getArmorMaterialOverride(this.names[armor]);

    if (!override || this.hasMaterialKeyword(armor)) { return; }

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
      overrideCraftingRecipes(this.cobj, armor, overrideMap[override].perk, this.patchFile);
    }
  }

  getArmorMaterialOverride(name) {
    const override = this.armor.materialOverrides.find((o) => name.includes(o.armorSubstring));
    return override ? override.materialOverride : null;
  }

  hasMaterialKeyword(armor) {
    const s = this.statics;
    const kwda = getKwda(armor);
    return kwda(s.kwArmorMaterialDaedric) || kwda(s.kwArmorMaterialSteel) ||
           kwda(s.kwArmorMaterialIron) || kwda(s.kwArmorMaterialDwarven) ||
           kwda(s.kwArmorMaterialFalmer) || kwda(s.kwArmorMaterialOrcish) ||
           kwda(s.kwArmorMaterialEbony) || kwda(s.kwArmorMaterialSteelPlate) ||
           kwda(s.kwArmorMaterialDragonplate) || kwda(s.kwArmorMaterialFur) ||
           kwda(s.kwArmorMaterialHide) || kwda(s.kwArmorMaterialLeather) ||
           kwda(s.kwArmorMaterialElven) || kwda(s.kwArmorMaterialScaled) ||
           kwda(s.kwArmorMaterialGlass) || kwda(s.kwArmorMaterialDragonscale) ||
           kwda(s.kwArmorMaterialNordicHeavy) || kwda(s.kwArmorMaterialStalhrimHeavy) ||
           kwda(s.kwArmorMaterialStalhrimLight) || kwda(s.kwArmorMaterialBonemoldHeavy);
  }

  patchArmorRating(armor) {
    if (this.names[armor] === 'Forsworn Boots') { debugger; }
    const rating = Math.floor(this.getArmorSlotMultiplier(armor) * this.getMaterialArmorModifier(armor));
    xelib.SetValue(armor, 'DNAM', `${rating}`);
  }

  getArmorSlotMultiplier(armor) {
    const kwda = getKwda(armor);
    if (kwda(this.statics.kwArmorSlotBoots)) { return this.settings.armorBaseStats.fArmorFactorBoots; }
    if (kwda(this.statics.kwArmorSlotCuirass)) { return this.settings.armorBaseStats.fArmorFactorCuirass; }
    if (kwda(this.statics.kwArmorSlotGauntlets)) { return this.settings.armorBaseStats.fArmorFactorGauntlets; }
    if (kwda(this.statics.kwArmorSlotHelmet)) { return this.settings.armorBaseStats.fArmorFactorHelmet; }
    if (kwda(this.statics.kwArmorSlotShield)) { return this.settings.armorBaseStats.fArmorFactorShield; }

    return 0;
  }

  getMaterialArmorModifier(armor) {
    let armorRating = getValueFromName(this.armor.materials, this.names[armor], 'name', 'iArmor');

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
        armorRating = getValueFromName(this.armor.materials, pair.name, 'name', 'iArmor');
        return true;
      }
    });

    if (armorRating !== null) { return armorRating; }

    return 0;
  }

  modifyRecipes(armor) {
    const armorFormID = xelib.GetFormID(armor);
    this.cobj.forEach((recipe) => {
      this.modifyTemperingRecipe(armor, armorFormID, recipe);
      this.modifyLeatherCraftingRecipe(armor, armorFormID, recipe);
    });
  }

  modifyTemperingRecipe(armor, armorFormID, recipe) {
    if (!xelib.HasElement(recipe, 'CNAM') || !xelib.HasElement(recipe, 'BNAM')) { return; }

    const bnam = xelib.GetUIntValue(recipe, 'BNAM');
    const cnam = xelib.GetUIntValue(recipe, 'CNAM');
    const bench = parseInt(this.statics.kwCraftingSmithingArmorTable, 16);

    if (bnam !== bench || cnam !== armorFormID) { return; }

    const perk = this.temperingPerkFromKeyword(armor);

    if (!perk) { return; }

    const newRecipe = xelib.CopyElement(recipe, this.patchFile);
    const condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
  }

  temperingPerkFromKeyword(armor) {
    const s = this.statics;
    const kwda = getKwda(armor);
    let perk;

    if (kwda(s.kwArmorMaterialDaedric)) {
      perk = s.perkSmithingDaedric;
    } else if (kwda(s.kwArmorMaterialDragonplate) || kwda(s.kwArmorMaterialDragonscale))  {
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

  modifyLeatherCraftingRecipe(armor, armorFormID, recipe) {
    if (!xelib.HasElement(recipe, 'CNAM') ||
        !xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialLeather)) {
      return;
    }

    const cnam = xelib.GetUIntValue(recipe, 'CNAM');
    if (cnam !== armorFormID) { return; }

    const newRecipe = xelib.CopyElement(recipe, this.patchFile);
    createHasPerkCondition(newRecipe, 10000000, 1, this.statics.perkSmithingLeather);
  }

  addMeltdownRecipe(armor) {
    const s = this.statics;
    const kwda = getKwda(armor);
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

    if (kwda(s.kwArmorSlotCuirass) || kwda(s.kwArmorSlotShield)) {
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
    xelib.AddElementValue(recipe, 'EDID', `REP_MELTDOWN_${this.names[armor]}`);
    xelib.AddElementValue(recipe, 'BNAM', bnam);
    xelib.AddElementValue(recipe, 'CNAM', cnam);
    xelib.AddElementValue(recipe, 'NAM1', `${outputQuantity}`);

    xelib.AddElement(recipe, 'Items');
    const baseItem = xelib.GetElement(recipe, 'Items\\[0]');
    xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetIntValue(baseItem, 'CNTO\\Count', inputQuantity);

    xelib.AddElement(recipe, 'Conditions');
    const condition = xelib.GetElement(recipe, 'Conditions\\[0]');
    updateHasPerkCondition(recipe, condition, 10000000, 1, this.statics.perkSmithingMeltdown);

    if (perk) {
      createHasPerkCondition(recipe, 10000000, 1, perk);
    }

    createGetItemCountCondition(recipe, 11000000, 1.0, armor);
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

    alchemyBaseStats: {
      bUsePriceLimits: true,
      iDurationBase: 2,
      priceLimitLower: 5,
      priceLimitUpper: 150,
    },

    armorBaseStats: {
      fArmorFactorBoots: 1,
      fArmorFactorCuirass: 3,
      fArmorFactorGauntlets: 1,
      fArmorFactorHelmet: 1.5,
      fArmorFactorShield: 1.5,
      fProtectionPerArmor: 0.1,
      fMaxProtection: 95
    },

    weaponBaseStats: {
      fSpeedBonusArbalestCrossbow: -0.2,
      fSpeedBonusLightweightCrossbow: 0.25,
      fWeightFactorArbalestCrossbow: 1.25,
      fWeightFactorLighweightCrossbow: 0.75,
      iDamageBaseBow: 22,
      iDamageBaseCrossbow: 30,
      iDamageBaseOneHanded: 12,
      iDamageBaseTwoHanded: 23,
      iDamageBonusRecurveCrossbow: 8
    },

    requiredFiles: ['SkyRe_Main.esp'],

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
        // new AlchemyPatcher(),
        new ArmorPatcher(),
        // new ProjectilePatcher(),
        // new WeaponPatcher()
      ],

      finalize: this.finalize.bind(this)
    };
  }

  // eslint-disable-next-line no-unused-vars
  initialize(patch, helpers, settings$$1, locals) {
    this.start = new Date();
    console.log(`started patching: ${this.start}`);

    locals.patch = patch;
    this.buildRules(locals);
    this.loadStatics(locals);
    locals.cobj = helpers.loadRecords('COBJ');
  }

  // eslint-disable-next-line no-unused-vars
  loadStatics(locals) {
    const files = {};
    const loadOrders = {};

    function getFile(filename) {
      return files[filename] ? files[filename] : files[filename] = xelib.FileByName(filename);
    }

    function getLoadOrder(file) {
      return loadOrders[file] ? loadOrders[file] : loadOrders[file] = xelib.GetFileLoadOrder(file)
    }

    function GetHex(formId, filename) {
      const loadOrder = getLoadOrder(getFile(filename));
      return xelib.Hex(loadOrder << 24 | formId);
    }

    const statics = locals.statics = {
      // Explosions
      expBarbed: GetHex(0x0C3421, "SkyRe_Main.esp"),
      expElementalFire: GetHex(0x010D90, "Dawnguard.esm"),
      expElementalFrost: GetHex(0x010D91, "Dawnguard.esm"),
      expElementalShock: GetHex(0x010D92, "Dawnguard.esm"),
      expExploding: GetHex(0x00F952, "SkyRe_Main.esp"),
      expHeavyweight: GetHex(0x3DF04C, "SkyRe_Main.esp"),
      expNoisemaker: GetHex(0x03A323, "SkyRe_Main.esp"),
      expNeuralgia: GetHex(0x3DF04F, "SkyRe_Main.esp"),
      expTimebomb: GetHex(0x00F944, "SkyRe_Main.esp"),

      // Game Settings
      gmstfArmorScalingFactor: GetHex(0x021A72, 'Skyrim.esm'),
      gmstfMaxArmorRating: GetHex(0x037DEB, 'Skyrim.esm'),

      // Items
      ingotCorundum: GetHex(0x05AD93, "Skyrim.esm"),
      ingotDwarven: GetHex(0x0DB8A2, "Skyrim.esm"),
      ingotEbony: GetHex(0x05AD9D, "Skyrim.esm"),
      ingotGold: GetHex(0x05AD9E, "Skyrim.esm"),
      ingotIron: GetHex(0x05ACE4, 'Skyrim.esm'),
      ingotMalachite: GetHex(0x05ADA1, "Skyrim.esm"),
      ingotMoonstone: GetHex(0x05AD9F, "Skyrim.esm"),
      ingotOrichalcum: GetHex(0x05AD99, "Skyrim.esm"),
      ingotQuicksilver: GetHex(0x05ADA0, "Skyrim.esm"),
      ingotSilver: GetHex(0x05ACE3, "Skyrim.esm"),
      ingotSteel: GetHex(0x05ACE5, "Skyrim.esm"),

      ale: GetHex(0x034C5E, "Skyrim.esm"),
      boneMeal: GetHex(0x034CDD, "Skyrim.esm"),
      charcoal: GetHex(0x033760, "Skyrim.esm"),
      chaurusChitin: GetHex(0x03AD57, "Skyrim.esm"),
      deathBell: GetHex(0x0516C8, "Skyrim.esm"),
      dragonbone: GetHex(0x03ADA4, "Skyrim.esm"),
      dragonscale: GetHex(0x03ADA3, "Skyrim.esm"),
      fireSalt: GetHex(0x03AD5E, "Skyrim.esm"),
      firewood: GetHex(0x06F993, "Skyrim.esm"),
      frostSalt: GetHex(0x03AD5F, "Skyrim.esm"),
      leather: GetHex(0x0DB5D2, "Skyrim.esm"),
      leatherStrips: GetHex(0x0800E4, "Skyrim.esm"),
      netchLeather: GetHex(0x01CD7C, "Dragonborn.esm"),
      oreStalhrim: GetHex(0x02B06B, "Dragonborn.esm"),
      pettySoulGem: GetHex(0x02E4E2, "Skyrim.esm"),
      torchbugThorax: GetHex(0x04DA73, "Skyrim.esm"),
      voidSalt: GetHex(0x03AD60, "Skyrim.esm"),

      // Keywords
      kwClothingHands: GetHex(0x10CD13, "Skyrim.esm"),
      kwClothingHead: GetHex(0x10CD11, "Skyrim.esm"),
      kwClothingFeet: GetHex(0x10CD12, "Skyrim.esm"),
      kwClothingBody: GetHex(0x0A8657, "Skyrim.esm"),
      kwArmorClothing: GetHex(0x06BB8, "Skyrim.esm"),
      kwArmorHeavy: GetHex(0x06BBD2, "Skyrim.esm"),
      kwArmorLight: GetHex(0x06BBD3, "Skyrim.esm"),
      kwArmorDreamcloth: GetHex(0x05C2C4, "SkyRe_Main.esp"),
      kwArmorMaterialBlades: GetHex(0x008255, "SkyRe_Main.esp"),
      kwArmorMaterialBonemoldHeavy: GetHex(0x024101, "Dragonborn.esm"),
      kwArmorMaterialDaedric: GetHex(0x06BBD4, "Skyrim.esm"),
      kwArmorMaterialDarkBrotherhood: GetHex(0x10FD62, "Skyrim.esm"),
      kwArmorMaterialDawnguard: GetHex(0x012CCD, "Dawnguard.esm"),
      kwArmorMaterialDragonplate: GetHex(0x06BBD5, "Skyrim.esm"),
      kwArmorMaterialDragonscale: GetHex(0x06BBD6, "Skyrim.esm"),
      kwArmorMaterialDraugr: GetHex(0x008257, "SkyRe_Main.esp"),
      kwArmorMaterialDwarven: GetHex(0x06BBD7, "Skyrim.esm"),
      kwArmorMaterialEbony: GetHex(0x06BBD8, "Skyrim.esm"),
      kwArmorMaterialElven: GetHex(0x06BBD9, "Skyrim.esm"),
      kwArmorMaterialElvenGilded: GetHex(0x06BBDA, "Skyrim.esm"),
      kwArmorMaterialFalmer: GetHex(0x008258, "SkyRe_Main.esp"),
      kwArmorMaterialFalmerHardened: GetHex(0x012CCE, "Dawnguard.esm"),
      kwArmorMaterialFalmerHeavy: GetHex(0x012CCF, "Dawnguard.esm"),
      kwArmorMaterialFalmerHeavyOriginal: GetHex(0x012CD0, "Dawnguard.esm"),
      kwArmorMaterialFur: GetHex(0x008254, "SkyRe_Main.esp"),
      kwArmorMaterialGlass: GetHex(0x06BBDC, "Skyrim.esm"),
      kwArmorMaterialHide: GetHex(0x06BBDD, "Skyrim.esm"),
      kwArmorMaterialHunter: GetHex(0x0050C4, "Dawnguard.esm"),
      kwArmorMaterialImperialHeavy: GetHex(0x06BBE2, "Skyrim.esm"),
      kwArmorMaterialImperialLight: GetHex(0x06BBE0, "Skyrim.esm"),
      kwArmorMaterialImperialStudded: GetHex(0x06BBE1, "Skyrim.esm"),
      kwArmorMaterialIron: GetHex(0x06BBE3, "Skyrim.esm"),
      kwArmorMaterialIronBanded: GetHex(0x06BBE4, "Skyrim.esm"),
      kwArmorMaterialLeather: GetHex(0x06BBDB, "Skyrim.esm"),
      kwArmorMaterialNightingale: GetHex(0x10FD61, "Skyrim.esm"),
      kwArmorMaterialNordicHeavy: GetHex(0x024105, "Dragonborn.esm"),
      kwArmorMaterialOrcish: GetHex(0x06BBE5, "Skyrim.esm"),
      kwArmorMaterialScaled: GetHex(0x06BBDE, "Skyrim.esm"),
      kwArmorMaterialStalhrimHeavy: GetHex(0x024106, "Dragonborn.esm"),
      kwArmorMaterialStalhrimLight: GetHex(0x024107, "Dragonborn.esm"),
      kwArmorMaterialSteel: GetHex(0x06BBE6, "Skyrim.esm"),
      kwArmorMaterialSteelPlate: GetHex(0x06BBE7, "Skyrim.esm"),
      kwArmorMaterialStormcloak: GetHex(0x0AC13A, "Skyrim.esm"),
      kwArmorMaterialStudded: GetHex(0x06BBDF, "Skyrim.esm"),
      kwArmorMaterialVampire: GetHex(0x01463E, "Dawnguard.esm"),
      kwArmorShieldHeavy: GetHex(0x08F265, "SkyRe_Main.esp"),
      kwArmorShieldLight: GetHex(0x08F266, "SkyRe_Main.esp"),
      kwArmorSlotGauntlets: GetHex(0x06C0EF, "Skyrim.esm"),
      kwArmorSlotHelmet: GetHex(0x06C0EE, "Skyrim.esm"),
      kwArmorSlotBoots: GetHex(0x06C0ED, "Skyrim.esm"),
      kwArmorSlotCuirass: GetHex(0x06C0EC, "Skyrim.esm"),
      kwArmorSlotShield: GetHex(0x0965B2, "Skyrim.esm"),
      kwCraftingSmelter: GetHex(0x00A5CCE, "Skyrim.esm"),
      kwCraftingSmithingArmorTable: GetHex(0x0ADB78, "Skyrim.esm"),
      kwCraftingSmithingForge: GetHex(0x088105, "Skyrim.esm"),
      kwCraftingSmithingSharpeningWheel: GetHex(0x088108, "Skyrim.esm"),
      kwCraftingTanningRack: GetHex(0x07866A, "Skyrim.esm"),
      kwJewelry: GetHex(0x08F95A, "Skyrim.esm"),
      kwMasqueradeBandit: GetHex(0x03A8AA, "SkyRe_Main.esp"),
      kwMasqueradeForsworn: GetHex(0x03A8A9, "SkyRe_Main.esp"),
      kwMasqueradeImperial: GetHex(0x037D31, "SkyRe_Main.esp"),
      kwMasqueradeStormcloak: GetHex(0x037D2F, "SkyRe_Main.esp"),
      kwMasqueradeThalmor: GetHex(0x037D2B, "SkyRe_Main.esp"),
      kwVendorItemClothing: GetHex(0x08F95B, "Skyrim.esm"),
      kwWeapMaterialDaedric: GetHex(0x01E71F, "Skyrim.esm"),
      kwWeapMaterialDragonbone: GetHex(0x019822, "Dawnguard.esm"),
      kwWeapMaterialDraugr: GetHex(0x0C5C01, "Skyrim.esm"),
      kwWeapMaterialDraugrHoned: GetHex(0x0C5C02, "Skyrim.esm"),
      kwWeapMaterialDwarven: GetHex(0x01E71A, "Skyrim.esm"),
      kwWeapMaterialEbony: GetHex(0x01E71E, "Skyrim.esm"),
      kwWeapMaterialElven: GetHex(0x01E71B, "Skyrim.esm"),
      kwWeapMaterialFalmer: GetHex(0x0C5C03, "Skyrim.esm"),
      kwWeapMaterialFalmerHoned: GetHex(0x0C5C04, "Skyrim.esm"),
      kwWeapMaterialGlass: GetHex(0x01E71D, "Skyrim.esm"),
      kwWeapMaterialImperial: GetHex(0x0C5C00, "Skyrim.esm"),
      kwWeapMaterialIron: GetHex(0x01E718, "Skyrim.esm"),
      kwWeapMaterialNordic: GetHex(0x026230, "Dragonborn.esm"),
      kwWeapMaterialOrcish: GetHex(0x01E71C, "Skyrim.esm"),
      kwWeapMaterialSilver: GetHex(0x10AA1A, "Skyrim.esm"),
      kwWeapMaterialSilverRefined: GetHex(0x24F987, "SkyRe_Main.esp"),
      kwWeapMaterialStalhrim: GetHex(0x02622F, "Dragonborn.esm"),
      kwWeapMaterialSteel: GetHex(0x01E719, "Skyrim.esm"),
      kwWeapMaterialWood: GetHex(0x01E717, "Skyrim.esm"),
      kwWeapTypeBastardSword: GetHex(0x054FF1, "SkyRe_Main.esp"),
      kwWeapTypeBattleaxe: GetHex(0x06D932, "Skyrim.esm"),
      kwWeapTypeBattlestaff: GetHex(0x020857, "SkyRe_Main.esp"),
      kwWeapTypeBow: GetHex(0x01E715, "Skyrim.esm"),
      kwWeapTypeBroadsword: GetHex(0x05451F, "SkyRe_Main.esp"),
      kwWeapTypeClub: GetHex(0x09BA23, "SkyRe_Main.esp"),
      kwWeapTypeCrossbow: GetHex(0x06F3FD, "Skyrim.esm"),
      kwWeapTypeDagger: GetHex(0x01E713, "Skyrim.esm"),
      kwWeapTypeGlaive: GetHex(0x09BA40, "SkyRe_Main.esp"),
      kwWeapTypeGreatsword: GetHex(0x06D931, "Skyrim.esm"),
      kwWeapTypeHalberd: GetHex(0x09BA3E, "SkyRe_Main.esp"),
      kwWeapTypeHatchet: GetHex(0x333676, "SkyRe_Main.esp"),
      kwWeapTypeKatana: GetHex(0x054523, "SkyRe_Main.esp"),
      kwWeapTypeLongbow: GetHex(0x06F3FE, "Skyrim.esm"),
      kwWeapTypeLongmace: GetHex(0x0A068F, "SkyRe_Main.esp"),
      kwWeapTypeLongsword: GetHex(0x054520, "SkyRe_Main.esp"),
      kwWeapTypeMace: GetHex(0x01E714, "Skyrim.esm"),
      kwWeapTypeMaul: GetHex(0x333677, "SkyRe_Main.esp"),
      kwWeapTypeNodachi: GetHex(0x054A88, "SkyRe_Main.esp"),
      kwWeapTypeSaber: GetHex(0x054A87, "SkyRe_Main.esp"),
      kwWeapTypeScimitar: GetHex(0x054A87, "SkyRe_Main.esp"),
      kwWeapTypeShortbow: GetHex(0x056B5F, "SkyRe_Main.esp"),
      kwWeapTypeShortspear: GetHex(0x1AC2B9, "SkyRe_Main.esp"),
      kwWeapTypeShortsword: GetHex(0x085067, "SkyRe_Main.esp"),
      kwWeapTypeStaff: GetHex(0x01E716, "Skyrim.esm"),
      kwWeapTypeSword: GetHex(0x01E711, "Skyrim.esm"),
      kwWeapTypeTanto: GetHex(0x054522, "SkyRe_Main.esp"),
      kwWeapTypeUnarmed: GetHex(0x066F62, "SkyRe_Main.esp"),
      kwWeapTypeWakizashi: GetHex(0x054521, "SkyRe_Main.esp"),
      kwWeapTypeWaraxe: GetHex(0x01E712, "Skyrim.esm"),
      kwWeapTypeWarhammer: GetHex(0x06D930, "Skyrim.esm"),
      kwWeapTypeYari: GetHex(0x09BA3F, "SkyRe_Main.esp"),

      // Lights
      lightLightsource: GetHex(0x03A335, "SkyRe_Main.esp"),

      // Perks
      perkAlchemyFuse: GetHex(0x00FEDA, "SkyRe_Main.esp"),
      perkAlchemyAdvancedExplosives: GetHex(0x00FED9, "SkyRe_Main.esp"),
      perkDreamclothBody: GetHex(0x5CDA5, "SkyRe_Main.esp"),
      perkDreamclothHands: GetHex(0x5CDA8, "SkyRe_Main.esp"),
      perkDreamclothHead: GetHex(0x5CDA4, "SkyRe_Main.esp"),
      perkDreamclothFeet: GetHex(0x5CDA7, "SkyRe_Main.esp"),
      perkEnchantingElementalBombard0: GetHex(0x0AF659, "SkyRe_Main.esp"),
      perkEnchantingElementalBombard1: GetHex(0x3DF04E, "SkyRe_Main.esp"),
      perkMarksmanshipAdvancedMissilecraft0: GetHex(0x0AF670, "SkyRe_Main.esp"),
      perkMarksmanshipAdvancedMissilecraft1: GetHex(0x0AF6A4, "SkyRe_Main.esp"),
      perkMarksmanshipAdvancedMissilecraft2: GetHex(0x3DF04D, "SkyRe_Main.esp"),
      perkMarksmanshipArbalest: GetHex(0x0AF6A1, "SkyRe_Main.esp"),
      perkMarksmanshipBallistics: GetHex(0x0AF657, "SkyRe_Main.esp"),
      perkMarksmanshipEngineer: GetHex(0x0AF6A5, "SkyRe_Main.esp"),
      perkMarksmanshipLightweightConstruction: GetHex(0x0AF6A2, "SkyRe_Main.esp"),
      perkMarksmanshipRecurve: GetHex(0x0AF6A0, "SkyRe_Main.esp"),
      perkMarksmanshipSilencer: GetHex(0x0AF6A3, "SkyRe_Main.esp"),
      perkSmithingAdvanced: GetHex(0x0CB414, "Skyrim.esm"),
      perkSmithingArcaneBlacksmith: GetHex(0x05218E, "Skyrim.esm"),
      perkSmithingDaedric: GetHex(0x0CB413, "Skyrim.esm"),
      perkSmithingDragon: GetHex(0x052190, "Skyrim.esm"),
      perkSmithingDwarven: GetHex(0x0CB40E, "Skyrim.esm"),
      perkSmithingEbony: GetHex(0x0CB412, "Skyrim.esm"),
      perkSmithingElven: GetHex(0x0CB40F, "Skyrim.esm"),
      perkSmithingGlass: GetHex(0x0CB411, "Skyrim.esm"),
      perkSmithingLeather: GetHex(0x1D8BE6, "SkyRe_Main.esp"),
      perkSmithingMeltdown: GetHex(0x058F75, "Skyrim.esm"),
      perkSmithingOrcish: GetHex(0x0CB410, "Skyrim.esm"),
      perkSmithingSilver: GetHex(0x0581E2, "Skyrim.esm"),
      perkSmithingSilverRefined: GetHex(0x054FF5, "SkyRe_Main.esp"),
      perkSmithingSteel: GetHex(0x0CB40D, "Skyrim.esm"),
      perkSmithingWeavingMill: GetHex(0x05C827, "SkyRe_Main.esp"),
      perkSneakThiefsToolbox0: GetHex(0x037D35, "SkyRe_Main.esp"),
      perkWeaponCrossbow: GetHex(0x252122, "SkyRe_Main.esp"),
      perkWeaponCrossbowArbalest: GetHex(0x0AF6A6, "SkyRe_Main.esp"),
      perkWeaponCrossbowArbalestSilenced: GetHex(0x0AF6A8, "SkyRe_Main.esp"),
      perkWeaponCrossbowSilenced: GetHex(0x0AF6A7, "SkyRe_Main.esp"),
      perkWeaponShortspear: GetHex(0x1AC2BA, "SkyRe_Main.esp"),
      perkWeaponSilverRefined: GetHex(0x056B5C, "SkyRe_Main.esp"),
      perkWeaponYari: GetHex(0x09E623, "SkyRe_Main.esp")
    };

    console.log(statics);
  }

  // eslint-disable-next-line no-unused-vars
  finalize(patch, helpers, settings$$1, locals) {
    const end = new Date();
    console.log(`finished patching: ${end}`);
    console.log(`${Math.abs(this.start - end) / 1000}s`);
  }

  buildRules(locals) {
    const rules = locals.rules = {};

    xelib.GetLoadedFileNames().forEach((plugin) => {
      const data = fh.loadJsonFile(`modules/reproccerReborn/data/${plugin.slice(0, -4)}.json`, null);
      Object.deepAssign(rules, data);
    });
  }
}

registerPatcher(new ReproccerReborn(fh, info));
