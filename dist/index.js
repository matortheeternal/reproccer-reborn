class AlchemyPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
    this.updateEffect = this.updateEffect.bind(this);
  }

  // eslint-disable-next-line no-unused-vars
  load(plugin, helpers, settings, locals) {
    this.alchemy = locals.rules.alchemy;
    this.settings = settings;

    if (!settings.patchAlchemyIngredients) {
      return false;
    }

    return {
      signature: 'INGR'
    }
  }

  // eslint-disable-next-line no-unused-vars
  patch(ingredient, helpers, settings, locals) {
    this.updateEffects(ingredient);
    this.clampValue(ingredient);
  }

  updateEffects(ingredient) {
    xelib.GetElements(ingredient, 'Effects').forEach(this.updateEffect);
  }

  updateEffect(effect) {
    const mgef = xelib.GetWinningOverride(xelib.GetLinksTo(effect, 'EFID'));
    const name = xelib.FullName(mgef);

    if (this.alchemy.excludedEffects.includes(name)) {
      return;
    }

    let newDuration = xelib.GetIntValue(effect, 'EFIT\\Duration');
    let newMagnitude = xelib.GetFloatValue(effect, 'EFIT\\Magnitude');

    this.alchemy.baseStats.effects.some((e) => {
      if (name.includes(e.name)) {
        newDuration = this.settings.alchemyBaseStats.iDurationBase + e.iDurationBonus;
        newMagnitude = newMagnitude * e.fMagnitudeFactor;
        return true;
      }
    });

    if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Duration')) {
      xelib.SetIntValue(effect, 'EFIT\\Duration', newDuration);
    }

    if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Magnitude')) {
      newMagnitude = Math.max(1.0, newMagnitude);
      xelib.SetFloatValue(effect, 'EFIT\\Magnitude', newMagnitude);
    }
  }

  clampValue(ingredient) {
    if (!this.settings.alchemyBaseStats.bUsePriceLimits) {
      return;
    }

    const min = this.settings.alchemyBaseStats.priceLimitLower;
    const max = this.settings.alchemyBaseStats.priceLimitUpper;
    const originalValue = xelib.GetValue(ingredient, 'DATA\\Value');
    const newValue = Math.min(Math.max(originalValue, min), max);

    xelib.SetFlag(ingredient, 'ENIT\\Flags', 'No auto-calculation', true);
    xelib.SetIntValue(ingredient, 'DATA\\Value', newValue);
  }
}

function overrideCraftingRecipes(cobj, armor, perk, patchFile) {
  const armorFormID = xelib.GetFormID(armor);

  cobj.forEach((recipe) => {
    if (recipe.cnam !== armorFormID) { return; }

    const newRecipe = xelib.CopyElement(recipe.handle, patchFile);
    xelib.RemoveElement(newRecipe, 'Conditions');

    if (perk) {
      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(recipe.handle, condition, 10000000, 1, perk);
    }
  });
}

function createHasPerkCondition(recipe, type, value, perk) {
  const condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateHasPerkCondition(recipe, condition, type, value, perk);
  return condition;
}

function updateHasPerkCondition(recipe, condition, type, value, perk) {
  xelib.SetValue(condition, 'CTDA\\Type', `${type}`);
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
  xelib.SetValue(condition, 'CTDA\\Type', `${type}`);
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'GetItemCount');
  xelib.SetValue(condition, 'CTDA\\Inventory Object', xelib.GetHexFormID(object));
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}

const includes = function(a, b) { return a.includes(b); };
const equals = function(a, b) { return a === b; };
const compare = (a, b, inclusion) => inclusion ? includes(a, b) : equals(a, b);
function getValueFromName(collection, name, field1, field2, includes = true) {
  let maxLength = 0;
  let value = null;

  collection.forEach((thing) => {
    if (compare(name, thing[field1], includes) && thing[field1].length > maxLength) {
      value = thing[field2];
      maxLength = thing[field1].length;
    }
  });

  return value;
}

function getModifierFromMap(map, collection, handle, field1, field2, includes = true) {
  let modifier = null;

  map.some((e) => {
    if (xelib.HasArrayItem(handle, 'KWDA', '', e.kwda)) {
      modifier = getValueFromName(collection, e.name, field1, field2, includes);
      return true;
    }
  });

  return modifier;
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
  xelib.SetValue(property, 'Flags', 'Edited');
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', perk);
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\Alias', 'None');
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
      filter: (armor) => {
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
    const armorHasLeatherKwda = xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialLeather);
    this.cobj.forEach((recipe) => {
      this.modifyTemperingRecipe(armor, armorFormID, recipe);
      this.modifyLeatherCraftingRecipe(armor, armorFormID, armorHasLeatherKwda, recipe);
    });
  }

  modifyTemperingRecipe(armor, armorFormID, recipe) {
    const bnam = recipe.bnam;
    const cnam = recipe.cnam;
    const bench = parseInt(this.statics.kwCraftingSmithingArmorTable, 16);

    if (bnam !== bench || cnam !== armorFormID) { return; }

    const perk = this.temperingPerkFromKeyword(armor);

    if (!perk) { return; }

    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
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

  modifyLeatherCraftingRecipe(armor, armorFormID, armorHasLeatherKwda, recipe) {
    if (!armorHasLeatherKwda || recipe.cnam !== armorFormID) { return; }

    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
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

class ProjectilePatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, helpers, settings, locals) {
    if (!settings.patchProjectiles) {
      return false;
    }

    this.patchFile = locals.patch;
    this.projectiles = locals.rules.projectiles;
    this.statics = locals.statics;
    this.names = {};

    return {
      signature: 'AMMO',
      filter: (record) => {
        const ammo = xelib.GetWinningOverride(record);
        const name = xelib.FullName(ammo);
        if (!name) { return false; }
        if (this.projectiles.excludedAmmunition.find((ex) => name.includes(ex))) { return false; }
        if (!this.projectiles.baseStats.find((bs) => name.includes(bs.sIdentifier))) { return false; }

        return true;
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  patch(ammo, helpers, settings, locals) {
    this.names[ammo] = xelib.FullName(ammo);
    this.patchStats(ammo);
    this.addVariants(ammo);
  }

  patchStats(ammo) {
    let {newGravity, newSpeed, newRange, newDamage, failed } = this.calculateProjectileStats(this.names[ammo]);

    if (failed) { return; }

    const oldProjectile = xelib.GetWinningOverride(xelib.GetLinksTo(ammo, 'DATA\\Projectile'));
    const newProjectile = xelib.CopyElement(oldProjectile, this.patchFile, true);

    xelib.AddElementValue(newProjectile, 'EDID', `REP_PROJ_${this.names[ammo]}`);
    xelib.SetFloatValue(newProjectile, 'DATA\\Gravity', newGravity);
    xelib.SetFloatValue(newProjectile, 'DATA\\Speed', newSpeed);
    xelib.SetFloatValue(newProjectile, 'DATA\\Range', newRange);

    xelib.SetValue(ammo, 'DATA\\Projectile', xelib.GetHexFormID(newProjectile));
    xelib.SetIntValue(ammo, 'DATA\\Damage', newDamage);
  }

  calculateProjectileStats(name) {
    let newGravity = 0;
    let newSpeed = 0;
    let newRange = 0;
    let newDamage = 0;
    let failed = false;

    this.projectiles.baseStats.some((bs) => {
      if (name.includes(bs.sIdentifier)) {
        newGravity = bs.fGravityBase;
        newSpeed = bs.fSpeedBase;
        newRange = bs.fRangeBase;
        newDamage = bs.iDamageBase;
        return true;
      }
    });

    this.projectiles.materialStats.some((ms) => {
      if (name.includes(ms.name)) {
        newGravity += ms.fGravityModifier;
        newSpeed += ms.fSpeedModifier;
        newDamage += ms.iDamageModifier;
        return true;
      }
    });

    this.projectiles.modifierStats.some((ms) => {
      if (name.includes(ms.name)) {
        newGravity += ms.fGravityModifier;
        newSpeed += ms.fSpeedModifier;
        newDamage += ms.iDamageModifier;
        return true;
      }
    });

    failed = newGravity <= 0 || newSpeed <= 0 || newRange <= 0 || newDamage <= 0;

    return { newGravity, newSpeed, newRange, newDamage, failed };
  }

  addVariants(ammo) {
    if (this.projectiles.excludedAmmunitionVariants.find((v) => this.names[ammo].includes(v))) {
      return;
    }

    this.createVariants(ammo);
    this.multiplyBolts(ammo);
  }

  multiplyBolts(ammo) {
    if (this.projectiles.baseStats.find((bs) => this.names[ammo].includes(bs.sIdentifier) && bs.sType !== 'BOLT')) {
      return;
    }

    const s = this.statics;
    let secondaryIngredients = [];
    let requiredPerks = [];

    const strongAmmo = this.createStrongAmmo(ammo);
    secondaryIngredients = [s.ingotIron];
    requiredPerks = [s.perkMarksmanshipAdvancedMissilecraft0];
    this.addCraftingRecipe(ammo, strongAmmo, secondaryIngredients, requiredPerks);
    this.createVariants(strongAmmo);

    const strongestAmmo = this.createStrongestAmmo(ammo);
    secondaryIngredients = [s.ingotSteel, s.ingotIron];
    requiredPerks = [s.perkMarksmanshipAdvancedMissilecraft0];
    this.addCraftingRecipe(ammo, strongestAmmo, secondaryIngredients, requiredPerks);
    this.createVariants(strongestAmmo);
  }

  createStrongAmmo(ammo) {
    const strongAmmo = xelib.CopyElement(ammo, this.patchFile, true);
    this.names[strongAmmo] = `${this.names[ammo]} - Strong`;
    xelib.AddElementValue(strongAmmo, 'EDID', `REP_${this.names[ammo]} - Strong`);
    xelib.AddElementValue(strongAmmo, 'FULL', this.names[strongAmmo]);
    this.patchStats(strongAmmo);

    return strongAmmo;
  }

  createStrongestAmmo(ammo) {
    const strongestAmmo = xelib.CopyElement(ammo, this.patchFile, true);
    this.names[strongestAmmo] = `${this.names[ammo]} - Strongest`;
    xelib.AddElementValue(strongestAmmo, 'EDID', `REP_${this.names[ammo]} - Strongest`);
    xelib.AddElementValue(strongestAmmo, 'FULL', this.names[strongestAmmo]);
    this.patchStats(strongestAmmo);

    return strongestAmmo;
  }

  createExplodingAmmo(ammo) {
    const desc = 'Explodes upon impact, dealing 60 points of non-elemental damage.';
    return this.createExplosiveAmmo(ammo, this.statics.expExploding, 'Explosive', desc);
  }

  createTimebombAmmo(ammo) {
    const timer = 3;
    const timebombAmmo = xelib.CopyElement(ammo, this.patchFile, true);
    this.names[timebombAmmo] = `${this.names[ammo]} - Timebomb`;
    xelib.AddElementValue(timebombAmmo, 'EDID', `REP_${this.names[ammo]} - Timebomb`);
    xelib.AddElementValue(timebombAmmo, 'FULL', this.names[timebombAmmo]);
    xelib.AddElementValue(timebombAmmo, 'DESC', 'Explodes 3 seconds after being fired into a surface, dealing 150 points of non-elemental damage.');
    this.patchStats(timebombAmmo);

    const projectile = xelib.GetWinningOverride(xelib.GetLinksTo(timebombAmmo, 'DATA\\Projectile'));
    xelib.SetFlag(projectile, 'DATA\\Flags', 'Explosion', true);
    xelib.SetFlag(projectile, 'DATA\\Flags', 'Alt. Trigger', true);
    xelib.SetFloatValue(projectile, 'DATA\\Explosion - Alt. Trigger - Timer', timer);
    xelib.SetValue(projectile, 'DATA\\Explosion', this.statics.expTimebomb);

    return timebombAmmo;
  }

  createFrostAmmo(ammo) {
    const desc = 'Explodes upon impact, dealing 30 points of frost damage.';
    return this.createExplosiveAmmo(ammo, this.statics.expElementalFrost, 'Frost', desc);
  }

  createFireAmmo(ammo) {
    const desc = 'Explodes upon impact, dealing 30 points of fire damage.';
    return this.createExplosiveAmmo(ammo, this.statics.expElementalFire, 'Fire', desc);
  }

  createShockAmmo(ammo) {
    const desc = 'Explodes upon impact, dealing 30 points of shock damage.';
    return this.createExplosiveAmmo(ammo, this.statics.expElementalShock, 'Shock', desc);
  }

  createBarbedAmmo(ammo) {
    const desc = 'Deals 6 points of bleeding damag per second over 8 seconds, and slows the target down by 20%.';
    return this.createExplosiveAmmo(ammo, this.statics.expBarbed, 'Barbed', desc);
  }

  createHeavyweightAmmo(ammo) {
    const desc = 'Has a 50% increased chance to stagger, and a 25% chance to strike the target down.';
    return this.createExplosiveAmmo(ammo, this.statics.expHeavyweight, 'Heavyweight', desc);
  }

  createLightsourceAmmo(ammo) {
    const lightsourceAmmo = xelib.CopyElement(ammo, this.patchFile, true);
    this.names[lightsourceAmmo] = `${this.names[ammo]} - Lightsource`;
    xelib.AddElementValue(lightsourceAmmo, 'EDID', `REP_${this.names[ammo]} - Lightsource`);
    xelib.AddElementValue(lightsourceAmmo, 'FULL', this.names[lightsourceAmmo]);
    xelib.AddElementValue(lightsourceAmmo, 'DESC', 'Emits light after being fired.');
    this.patchStats(lightsourceAmmo);

    const projectile = xelib.GetWinningOverride(xelib.GetLinksTo(lightsourceAmmo, 'DATA\\Projectile'));
    xelib.SetValue(projectile, 'DATA\\Light', this.statics.lightLightsource);

    return lightsourceAmmo;
  }

  createNoisemakerAmmo(ammo) {
    const desc = 'Emits sound upon impact, distracting enemies.';
    return this.createExplosiveAmmo(ammo, this.statics.expNoisemaker, 'Noisemaker', desc);
  }

  createNeuralgiaAmmo(ammo) {
    const desc = 'Doubles spell casting cost and drains 10 points of Magicka per second for 10 seconds.';
    return this.createExplosiveAmmo(ammo, this.statics.expNeuralgia, 'Neuralgia', desc);
  }

  createExplosiveAmmo(ammo, explosion, type, desc) {
    const newAmmo = xelib.CopyElement(ammo, this.patchFile, true);
    this.names[newAmmo] = `${this.names[ammo]} - ${type}`;
    xelib.AddElementValue(newAmmo, 'EDID', `REP_${this.names[ammo]} - ${type}`);
    xelib.AddElementValue(newAmmo, 'FULL', this.names[newAmmo]);
    xelib.AddElementValue(newAmmo, 'DESC', desc);
    this.patchStats(newAmmo);

    const projectile = xelib.GetLinksTo(newAmmo, 'DATA\\Projectile');
    xelib.SetFlag(projectile, 'DATA\\Flags', 'Explosion', true);
    xelib.SetFlag(projectile, 'DATA\\Flags', 'Alt. Trigger', false);
    xelib.SetValue(projectile, 'DATA\\Explosion', explosion);

    return newAmmo;
  }

  createVariants(ammo) {
    const s = this.statics;
    let ingredients = [];
    let perks = [];

    const explodingAmmo = this.createExplodingAmmo(ammo);
    ingredients = [s.ale, s.torchbugThorax];
    perks = [s.perkAlchemyFuse];
    this.addCraftingRecipe(ammo, explodingAmmo, ingredients, perks);

    const timebombAmmo = this.createTimebombAmmo(ammo);
    ingredients = [s.fireSalt, s.torchbugThorax];
    perks = [s.perkAlchemyAdvancedExplosives];
    this.addCraftingRecipe(ammo, timebombAmmo, ingredients, perks);

    const lightsourceAmmo = this.createLightsourceAmmo(ammo);
    ingredients = [s.torchbugThorax, s.leatherStrips];
    perks = [s.perkSneakThiefsToolbox0];
    this.addCraftingRecipe(ammo, lightsourceAmmo, ingredients, perks);

    const noisemakerAmmo = this.createNoisemakerAmmo(ammo);
    ingredients = [s.pettySoulGem, s.boneMeal];
    perks = [s.perkSneakThiefsToolbox0];
    this.addCraftingRecipe(ammo, noisemakerAmmo, ingredients, perks);

    if (this.projectiles.baseStats.find((bs) => this.names[ammo].includes(bs.sIdentifier) && bs.sType !== 'ARROW')) {
      this.createCrossbowOnlyVariants(ammo);
    }
  }

  createCrossbowOnlyVariants(ammo) {
    const s = this.statics;
    let ingredients = [];
    let perks = [];

    const fireAmmo = this.createFireAmmo(ammo);
    ingredients = [s.pettySoulGem, s.fireSalt];
    perks = [s.perkEnchantingElementalBombard0];
    this.addCraftingRecipe(ammo, fireAmmo, ingredients, perks);

    const frostAmmo = this.createFrostAmmo(ammo);
    ingredients = [s.pettySoulGem, s.frostSalt];
    perks = [s.perkEnchantingElementalBombard0];
    this.addCraftingRecipe(ammo, frostAmmo, ingredients, perks);

    const shockAmmo = this.createShockAmmo(ammo);
    ingredients = [s.pettySoulGem, s.voidSalt];
    perks = [s.perkEnchantingElementalBombard0];
    this.addCraftingRecipe(ammo, shockAmmo, ingredients, perks);

    const neuralgiaAmmo = this.createNeuralgiaAmmo(ammo);
    ingredients = [s.pettySoulGem, s.deathBell];
    perks = [s.perkEnchantingElementalBombard1];
    this.addCraftingRecipe(ammo, neuralgiaAmmo, ingredients, perks);

    const barbedAmmo = this.createBarbedAmmo(ammo);
    ingredients = [s.ingotSteel, s.deathBell];
    perks = [s.perkMarksmanshipAdvancedMissilecraft1];
    this.addCraftingRecipe(ammo, barbedAmmo, ingredients, perks);

    const heavyweightAmmo = this.createHeavyweightAmmo(ammo);
    ingredients = [s.ingotSteel, s.boneMeal];
    perks = [s.perkMarksmanshipAdvancedMissilecraft2];
    this.addCraftingRecipe(ammo, heavyweightAmmo, ingredients, perks);
  }

  addCraftingRecipe(baseAmmo, newAmmo, secondaryIngredients, requiredPerks) {
    const ammoReforgeInputCount = 10;
    const ammoReforgeOutputCount = 10;
    const secondaryIngredientInputCount = 1;

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_AMMO_${this.names[newAmmo]}`);

    xelib.AddElement(newRecipe, 'Items');
    const baseItem = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(baseAmmo));
    xelib.SetIntValue(baseItem, 'CNTO\\Count', ammoReforgeInputCount);

    secondaryIngredients.forEach((ingredient) => {
      const secondaryItem = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(secondaryItem, 'CNTO\\Item', ingredient);
      xelib.SetIntValue(secondaryItem, 'CNTO\\Count', secondaryIngredientInputCount);
    });

    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
    xelib.AddElementValue(newRecipe, 'NAM1', `${ammoReforgeOutputCount}`);
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(newAmmo));

    xelib.AddElement(newRecipe, 'Conditions');

    requiredPerks.forEach((perk, index) => {
      let condition;

      if (index == 0) {
          condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      } else {
        condition = xelib.AddElement(newRecipe, 'Conditions\\.');
      }

      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    });

    createGetItemCountCondition(newRecipe, 11000000, ammoReforgeInputCount, baseAmmo);
  }
}

class WeaponPatcher {
  constructor() {
    this.names = {};
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
    this.checkBroadswordName = this.checkBroadswordName.bind(this);
  }

  // eslint-disable-next-line no-unused-vars
  load(plugin, helpers, settings, locals) {
    if (!settings.patchWeapons) {
      return false;
    }

    this.settings = settings;
    this.weapons = locals.rules.weapons;
    this.statics = locals.statics;
    this.cobj = locals.cobj;
    this.patchFile = locals.patch;

    this.createKeywordMaps();

    return {
      signature: 'WEAP',
      filter: (weapon) => {
        const name = xelib.FullName(weapon);

        if (name && this.weapons.excludedWeapons.find((e) => name.includes(e))) { return false; }
        if (xelib.HasElement(weapon, 'KWDA') && xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeStaff)) { return false; }
        if (xelib.HasElement(weapon, 'CNAM')) { return true; }
        if (xelib.GetFlag(weapon, 'DNAM\\Flags', 'Non-playable')) { return false; }
        if (!name) { return false; }

        return true;
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  patch(weapon, helpers, settings, locals) {
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
  }

  checkBroadswordName(weapon, enchanted) {
    if (enchanted && !xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeSword)) { return; }
    if (this.names[weapon].includes('Broadsword')) { return; }

    this.names[weapon] = this.names[weapon].replace('Sword', 'Broadsword');
    xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
  }

  patchBowType(weapon, enchanted) {
    const kwda = getKwda(weapon);
    if (!kwda(this.statics.kwWeapTypeBow) || kwda(this.statics.kwWeapTypeCrossbow)) { return; }
    if (kwda(this.statics.kwWeapTypeLongbow) || kwda(this.statics.kwWeapTypeShortbow)) { return; }

    const name = this.names[weapon];
    if (enchanted && name.includes('Longbow') || name.includes('Shortbow') || name.includes('Crossbow')) { return; }

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
      xelib.AddElementValue(weapon, 'KWDA\\.', overrideMap[override].kwda);
      overrideCraftingRecipes(this.cobj, weapon, overrideMap[override].perk, this.patchFile);
    }
  }

  getWeaponTypeOverride(name) {
    const override = this.weapons.typeOverrides.find((t) => name === t.weaponName);
    return override ? override.weaponType : null;
  }

  getWeaponMaterialOverrideString(name) {
    const override = this.weapons.materialOverrides.find((o) => name.includes(o.weaponSubstring));
    return override ? override.materialOverride : null;
  }

  hasWeaponKeyword(weapon) {
    const s = this.statics;
    const kwda = function(kwda) { return xelib.HasArrayItem(weapon, 'KWDA', '', kwda); };
    return !kwda(s.kwWeapMaterialDaedric) || kwda(s.kwWeapMaterialDragonbone) || kwda(s.kwWeapMaterialDraugr) ||
           kwda(s.kwWeapMaterialDraugrHoned) || kwda(s.kwWeapMaterialDwarven) || kwda(s.kwWeapMaterialEbony) ||
           kwda(s.kwWeapMaterialElven) || kwda(s.kwWeapMaterialFalmer) || kwda(s.kwWeapMaterialFalmerHoned) ||
           kwda(s.kwWeapMaterialGlass) || kwda(s.kwWeapMaterialImperial) || kwda(s.kwWeapMaterialOrcish) ||
           kwda(s.kwWeapMaterialSilver) || kwda(s.kwWeapMaterialSilverRefined) || kwda(s.kwWeapMaterialSteel) ||
           kwda(s.kwWeapMaterialWood) || kwda(s.kwWeapMaterialStalhrim) || kwda(s.kwWeapMaterialNordic);
  }

  patchWeaponKeywords(weapon) {
    const typeString = getValueFromName(this.weapons.typeDefinitions, this.names[weapon], 'substring', 'typeBinding');

    if (!typeString) {
      this.patchBowType(weapon);
      return;
    }

    const s = this.statics;
    const noop = function() { return; };
    const addp = function(weapon, perk) { addPerkScript(weapon, 'xxxAddPerkWhileEquipped', 'p', perk); };
    const broad = (weapon) => this.checkBroadswordName(weapon);
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
    if (map && xelib.HasElement(weapon, 'KWDA') && !xelib.HasArrayItem(weapon, 'KWDA', '', map.kwda)) {
      xelib.AddArrayItem(weapon, 'KWDA', '', map.kwda);
      map.func(weapon, map.perk);
    }
  }

  patchWeaponDamage(weapon) {
    const baseDamage = this.getBaseDamage(weapon);
    const materialDamage = this.getWeaponMaterialDamageModifier(weapon);
    const typeDamage = this.getWeaponTypeDamageModifier(weapon);

    if (baseDamage === null || materialDamage === null || typeDamage === null) {
      console.log(`${this.names[weapon]}(${xelib.GetHexFormID(weapon)}): Base: ${baseDamage} Material: ${materialDamage} Type: ${typeDamage}`);
    }

    xelib.SetIntValue(weapon, 'DATA\\Damage', baseDamage + materialDamage + typeDamage);
  }

  getBaseDamage(weapon) {
    const s = this.statics;
    const kwda = getKwda(weapon);
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
      console.log(`${this.names[weapon]}(${xelib.GetHexFormID(weapon)}): Couldn't set base weapon damage.`);
    }

    return base;
  }

  getWeaponMaterialDamageModifier(weapon) {
    let modifier = null;
    modifier = getValueFromName(this.weapons.materials, this.names[weapon], 'name', 'iDamage');

    if (modifier) { return modifier; }

    modifier = getModifierFromMap(this.keywordMaterialMap, this.weapons.materials, weapon, 'name', 'iDamage');

    if (modifier === null) {
      console.log(`${this.names[weapon]}(${xelib.GetHexFormID(weapon)}): Couldn't find material damage modifier for weapon.`);
    }

    return modifier;
  }

  getWeaponTypeDamageModifier(weapon) {
    let modifier;

    modifier = getModifierFromMap(this.keywordTypesMap, this.weapons.types, weapon, 'name', 'iDamage', false);

    if (modifier === null) {
      console.log(`${this.names[weapon]}(${xelib.GetHexFormID(weapon)}): Couldn't find type damage modifier for weapon.`);
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
    let modifier = getModifierFromMap(this.skyreTypesMap, this.weapons.types, weapon, 'name', field2, false);
    if (modifier) { return modifier; }

    modifier = getValueFromName(this.weapons.types, this.names[weapon], 'name', field2, false);
    if (modifier) { return modifier; }

    modifier = getModifierFromMap(this.vanillaTypesMap, this.weapons.types, weapon, 'name', field2, false);
    if (modifier === null) {
      console.log(`${this.names[weapon]}(${xelib.GetHexFormID(weapon)}): Couldn't find type ${field2} modifier for weapon.`);
    }

    return modifier === null ? 0 : modifier;
  }

  modifyRecipes(weapon) {
    const weaponFormID = xelib.GetFormID(weapon);
    const weaponIsCrossbow = xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow);
    const excludedCrossbow = this.weapons.excludedCrossbows.find((e) => this.names[weapon].includes(e));

    this.cobj.forEach((recipe) => {
      this.modifyCrossbowCraftingRecipe(weapon, weaponFormID, weaponIsCrossbow, excludedCrossbow, recipe);
      this.modifyTemperingRecipe(weapon, weaponFormID, recipe);
    });
  }

  modifyCrossbowCraftingRecipe(weapon, weaponFormID, weaponIsCrossbow, excludedCrossbow, recipe) {
    if (!weaponIsCrossbow || excludedCrossbow || recipe.cnam !== weaponFormID) { return; }

    const bench = parseInt(this.statics.kwCraftingSmithingSharpeningWheel, 16);
    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
    if (recipe.bnam !== bench) {
      xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
    }

    xelib.RemoveElement(newRecipe, 'Conditions');
    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, this.statics.perkMarksmanshipBallistics);
  }

  modifyTemperingRecipe(weapon, weaponFormID, recipe) {
    const bnam = recipe.bnam;
    const cnam = recipe.cnam;
    const bench = parseInt(this.statics.kwCraftingSmithingSharpeningWheel, 16);

    if (bnam !== bench || cnam !== weaponFormID) { return; }

    const perk = this.temperingPerkFromKeyword(weapon);

    if (!perk) { return; }

    const newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
    const condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
  }

  temperingPerkFromKeyword(weapon) {
    const s = this.statics;
    const kwda = getKwda(weapon);
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
    keywordPerkMap.some((e) => {
      if (xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        perk = e.perk;
        return true;
      }
    });

    if (!perk && !kwda(s.kwWeapMaterialIron) && !kwda(s.kwWeapMaterialWood)) {
      console.log(`${this.names[weapon]}(${xelib.GetHexFormID(weapon)}): Couldn't determine material - tempering recipe not modified.`);
    }

    return perk;
  }

  processCrossbow(weapon) {
    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow)) { return; }
    if (this.weapons.excludedCrossbows.find((e) => this.names[weapon].includes(e))) { return; }

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
    addPerkScript(newArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalest);
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
    addPerkScript(newSilencedCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowSilenced);
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
    addPerkScript(newArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalest);
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
    addPerkScript(newRecurveSilencedCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowSilenced);
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
    addPerkScript(newLightweightArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalest);
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
    addPerkScript(newSilencedArbalestCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowArbalestSilenced);
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
    addPerkScript(newLightweightSilencedCrossbow, 'xxxAddPerkWhileEquipped', 'p', this.statics.perkWeaponCrossbowSilenced);
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
    const recurveDamage = this.settings.weaponBaseStats.iDamageBonusRecurveCrossbow;
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetIntValue(weapon, 'DATA\\Damage', baseDamage + materialDamage + typeDamage + recurveDamage);
    xelib.AddElementValue(weapon, 'DESC', `${desc} Deals additional damage.`);
  }

  applyArbalestCrossbowChanges(weapon) {
    const speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
    const weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed + this.settings.weaponBaseStats.fSpeedBonusArbalestCrossbow);
    xelib.SetFloatValue(weapon, 'DATA\\Weight', weight + this.settings.weaponBaseStats.fWeightFactorArbalestCrossbow);
    xelib.AddElementValue(weapon, 'DESC', `${desc} Deals double damage against blocking enemies but fires slower.`);
  }

  applyLightweightCrossbowChanges(weapon) {
    const speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
    const weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed + this.settings.weaponBaseStats.fSpeedBonusLightweightCrossbow);
    xelib.SetFloatValue(weapon, 'DATA\\Weight', weight + this.settings.weaponBaseStats.fWeightFactorLightweightCrossbow);
    xelib.AddElementValue(weapon, 'DESC', `${desc} Has increased attack speed.`);
  }

  applySilencedCrossbowChanges(weapon) {
    const desc = xelib.GetValue(weapon, 'DESC');
    xelib.AddElementValue(weapon, 'DESC', `${desc} Deals increased sneak attack damage.`);
  }

  processSilverWeapon(weapon) {
    if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapMaterialSilver)) { return; }

    const newName = `Refined ${this.names[weapon]}`;
    const desc = 'These supreme weapons set undead enemies ablaze, dealing extra damage.';
    const newRefinedSilverWeapon = xelib.CopyElement(weapon, this.patchFile, true);
    xelib.AddElementValue(newRefinedSilverWeapon, 'EDID', `REP_WEAPON_${newName}`);
    xelib.AddElementValue(newRefinedSilverWeapon, 'FULL', newName);
    this.names[newRefinedSilverWeapon] = newName;
    xelib.AddElementValue(newRefinedSilverWeapon, 'DESC', desc);
    xelib.AddElementValue(newRefinedSilverWeapon, 'KWDA\\.', this.statics.kwWeapMaterialSilverRefined);
    this.patchWeaponDamage(newRefinedSilverWeapon);
    this.patchWeaponReach(newRefinedSilverWeapon);
    this.patchWeaponSpeed(newRefinedSilverWeapon);

    if (!xelib.HasElement(newRefinedSilverWeapon, 'VMAD') || !xelib.HasScript(newRefinedSilverWeapon, 'SilverSwordScript')) {
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

    this.addTemperingRecipe(newRefinedSilverWeapon);
    const ingredients = [this.statics.ingotGold, this.statics.ingotQuicksilver, xelib.GetHexFormID(newRefinedSilverWeapon)];
    this.addCraftingRecipe(newRefinedSilverWeapon, [this.statics.perkSmithingSilverRefined], ingredients);
    this.addMeltdownRecipe(newRefinedSilverWeapon);
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
    xelib.AddElementValue(newRecipe, 'EDID', `REP_TEMPER_${this.names[weapon]}`);
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
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    }
  }

  addMeltdownRecipe(weapon) {
    const s = this.statics;
    const kwda = getKwda(weapon);
    let outputQuantity = 1;
    let inputQuantity = 1;
    let input, perk;

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
    xelib.AddElementValue(newRecipe, 'EDID', `REP_TEMPER_${this.names[weapon]}`);
    xelib.AddElement(newRecipe, 'Items');

    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', input);
    xelib.SetIntValue(ingredient, 'CNTO\\Count', inputQuantity);
    xelib.AddElementValue(newRecipe, 'NAM1',`${outputQuantity}`);
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
    let input, perk;

    this.keywordTemperMap.some((e) => {
      if (xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
        input = e.input;
        perk = e.perk;
        return true;
      }
    });

    if (!input) { return; }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_WEAPON_${this.names[weapon]}`);

    xelib.AddElement(newRecipe, 'Items');
    const baseItem = xelib.GetElement(newRecipe, 'Items\\[0]');
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

      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    });

    if (perk) {
      createHasPerkCondition(newRecipe, 10000000, 1, perk);
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
      { kwda: s.kwWeapTypeBastardSword,     name: "Bastard"       },
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
        new AlchemyPatcher(),
        new ArmorPatcher(),
        new ProjectilePatcher(),
        new WeaponPatcher()
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
    locals.cobj = helpers.loadRecords('COBJ').map((handle) => ({
        handle: xelib.GetWinningOverride(handle),
        cnam: xelib.GetUIntValue(handle, 'CNAM'),
        bnam: xelib.GetUIntValue(handle, 'BNAM')
      }));
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

    const first = fh.loadJsonFile(`modules/reproccerReborn/data/first.json`, null);
    Object.deepAssign(rules, first);

    xelib.GetLoadedFileNames().forEach((plugin) => {
      const data = fh.loadJsonFile(`modules/reproccerReborn/data/${plugin.slice(0, -4)}.json`, null);
      Object.deepAssign(rules, data);
    });

    const last = fh.loadJsonFile(`modules/reproccerReborn/data/last.json`, null);
    Object.deepAssign(rules, last);
    console.log(rules);
  }
}

registerPatcher(new ReproccerReborn(fh, info));
