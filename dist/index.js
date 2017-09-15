function overrideCraftingRecipes(cobj, armor, perk, patchFile) {
  cobj.forEach((recipe) => {
    const result = xelib.GetLinksTo(recipe, 'CNAM');

    if (!result || xelib.GetHexFormID(result) !== xelib.GetHexFormID(armor)) {
      return;
    }

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
      maxLength = thing[field2].length;
    }
  });

  return value;
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
    xelib.SetFloatValue(fArmorScalingFactor, 'DATA\\Float', this.settings.armorBaseStats.fMaxProtection);
  }

  patch(armor, helpers, settings, locals) {
    const name = xelib.FullName(armor);

    if (xelib.HasElement(armor, 'TNAM')) {
      this.patchShieldWeight(armor);
      return;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.VendorItemClothing)) {
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
      const keyword = xelib.AddElement(armor, 'KWDA\\.', this.statics.kwArmorShieldHeavy);

      if (!name.includes('Heavy Shield')) {
        xelib.AddElementValue(armor, 'FULL', name.replace('Shield', 'Heavy Shield'));
      }
    } else {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwArmorShieldLight);

      if (!name.includes('Light Shield')) {
        xelib.AddElementValue(armor, 'FULL', name.replace('Shield', 'Light Shield'));
      }
    }
  }

  hasHeavyMaterialKeyword(armor) {
    const kwda = getKwda(armor);
    return kwda(this.statics.kwArmorMaterialBlades) ||
           kwda(this.statics.kwArmorMaterialDraugr) ||
           kwda(this.statics.kwArmorMaterialIron) ||
           kwda(this.statics.kwArmorMaterialDwarven) ||
           kwda(this.statics.kwArmorMaterialOrcish) ||
           kwda(this.statics.kwArmorMaterialFalmer1) ||
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
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeThalmor);
    }

    if (name.includes('Bandit') || name.includes('Fur')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeBandit);
    }

    if (name.includes('Imperial')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeImperial);
    }

    if (name.includes('Stormcloak')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeStormcloak);
    }

    if (name.includes('Forsworn') || name.includes('Old God')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeForsworn);
    }
  }

  processClothing(armor) {
    const name = xelib.FullName(armor);

    this.addClothingMeltdownRecipe(armor);

    if (name.includes('Dreamcloth')) { return; }

    if (xelib.HasElement(armor, 'EITM')) { return; }

    const dreamcloth = this.createDreamcloth(armor);
    if (!dreamcloth) {
      console.log(`${name}: Failed to generate dreamcloth variant.`);
      return;
    }

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
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwclothingheaq)) {
      dreamclothPerk = this.statics.perkDreamclothFeet;
    } else {
      console.log(`${name}: Flagged as clothing but lacking slot keywords.  No dreamcloth generated`);
      return null;
    }

    if (!dreamclothPerk) {
      console.log(`${name}: Could not find which perk to assign.  No dreamcloth generated`);
      return null;
    }

    const newName = `${name} [Dreamcloth]`;
    const newDreamcloth = xelib.CopyElement(armor, this.patchFile, true);
    xelib.AddElementValue(newDreamcloth, 'EDID', `REP_DREAMCLOTH_${newName}`);
    xelib.AddElementValue(newDreamcloth, 'FULL', newName);
    xelib.RemoveElement(newDreamcloth, 'EITM');
    xelib.RemoveElement(newDreamcloth, 'DESC');
    xelib.AddElement(newDreamcloth, 'KWDA\\.', this.statics.kwArmorDreamcloth);

    addPerkScript(newDreamcloth, 'xxxDreamCloth', 'p', dreamclothPerk);

    return newDreamcloth;
  }

  addClothingMeltdownRecipe(armor, isDreamCloth) {
    const s = this.statics;
    const kwda = helpers.getKwda(armor);
    const name = xelib.FullName(armor);
    let returnQuantity = 1;
    let inputQuantity = 1;

    if (kwda(s.kwClothingBody)) {
      returnQuantity += 2;
    } else if (kwda(s.kwClothingHands) || kwda(s.kwClothingHead) || kwda(s.kwClothingFeet)) {
      returnQuantity++;
    } else {
      console.log(`${name}: Couldn't find slot.  Meltdown recipe might be inappropriate.`);
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
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

    if (isDreamCloth) {
      createHasPerkCondition(newRecipe, 10000000, 1, s.perkSmithingWeavingMill);
      const condition2 = xelib.AddElement(newRecipe, 'Conditions\\.');
    }

    createGetItemCountCondition(newRecipe, 11000000, 1, armor);
  }

  addClothingCraftingRecipe(armor, isDreamCloth) {
    const s = this.statics;
    const kwda = helpers.getKwda(armor);
    const name = xelib.FullName(armor);
    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_CLOTHING_${name}`);

    let quantityIngredient1 = 2;

    if (kwda(s.kwClothingHands)) {
      quantityIngredient1 += 2;
    } else if (kwda(s.kwClothingHead)) {
      quantityIngredient1++;
    } else if (!kwda(s.kwClothingHands) && !kwda(s.kwClothingFeet)) {
      console.log(`${name}: Couldn't find slot.  Crafting recipe might be inappropriate.`);
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
      xelib.AddElement(armor, 'KWDA\\.', overrideMap[override].kwda);
      overrideCraftingRecipes(this.cobj, armor, overrideMap[override].perk, this.patchFile);
      return;
    }

    console.log(`${name}: Couldn't map override ${override} to any material.`);
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
    xelib.SetFloatValue(armor, 'DNAM', rating);
  }

  getArmorSlotMultiplier(armor) {
    if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotBoots)) { return this.settings.armorBaseStats.fArmorFactorBoots; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotCuirass)) { return this.settings.armorBaseStats.fArmorFactorCuirass; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotGauntlets)) { return this.settings.armorBaseStats.fArmorFactorGauntlets; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotHelmet)) { return this.settings.armorBaseStats.fArmorFactorHelmet; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorSlotShield)) { return this.settings.armorBaseStats.fArmorFactorShield; }

    console.log(`${xelib.FullName(armor)}: Couldn't determine slot.`);
    return 0;
  }

  getMaterialArmorModifier(armor) {
    const name = xelib.FullName(armor);
    let armorRating = getValueFromName(this.armor.materials, name, 'name', 'iArmor');

    if (armorRating !== null) { return armorRating; }

    this.armor.keyword_material_map.every((pair) => {
      if (xelib.HasArrayItem(armor, 'KWDA', '', pair.sKeyword)) {
        armorRating = getValueFromName(this.armor.materials, name, 'name', 'iArmor');
        return false;
      }
    });

    if (armorRating !== null) { return armorRating; }

    console.log(`${name}: Failed to find material armor base.`);
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
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
  }

  temperingPerkFromKeyword(armor) {
    const s = this.statics;
    const kwda = function(kwda) { return xelib.HasArrayItem(armor, 'KWDA', '', kwda); };
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
    } else if (kwda(w.kwArmorMaterialElven)  || kwda(s.kwArmorMaterialElvenGilded)) {
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

    console.log(`${xelib.FullName(armor)}: Couldn't determine material - tempering recipe not modified.`);
    return perk;
  }

  modifyLeatherCraftingRecipe(armor, recipe) {
    if (!xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialLeather)) { return; }

    const cnam = xelib.GetLinksTo(recipe, 'CNAM');
    if (!cnam || !xelib.ElementEquals(cnam, armor)) { return; }

    const newRecipe = xelib.CopyElement(recipe, this.patchFile);
    createHasPerkCondition(newRecipe, 10000000, 1, this.statics.perkSmithingLeather);
  }

  addMeltdownRecipe(armor) {
    const s = this.statics;
    const name = xelib.FullName(armor);
    const kwda = function(kwda) { return xelib.HasArrayItem(armor, 'KWDA', '', kwda); };
    const incr = function(v) { return v++; };
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
      outputQuantity++;
    }

    if (kwda(s.kwArmorMaterialDraugr)) {
      cnam = s.dragonScale;
      bnam = s.kwCraftingSmelter;
      perk = s.perkSmithingSteel;
      inputQuantity++;
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

    if (!cnam) {
      console.log(`${name}: Couldn't determine material - no meltdown recipe generated.`);
      return;
    }

    const recipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(recipe, 'EDID', `REP_MELTDOWN_${name}`);
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

class AlchemyPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

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

  patch(ingredient, helpers, settings, locals) {
    this.updateEffects(ingredient);
    this.clampValue(ingredient);
  }

  updateEffects(ingredient) {
    xelib.GetElements(ingredient, 'Effects').forEach(this.updateEffect.bind(this));
  }

  updateEffect(effect) {
    const mgef = xelib.GetLinksTo(effect, 'EFID');
    const name = xelib.FullName(mgef);

    if (this.alchemy.excluded_effects.includes(name)) {
      return;
    }

    let newDuration = xelib.GetValue(effect, 'EFIT\\Duration');
    let newMagnitude = xelib.GetValue(effect, 'EFIT\\Magnitude');

    this.alchemy.base_stats.effects.forEach((e) => {
      if (!name.includes(e.name)) {
        return;
      }

      newDuration = this.settings.alchemyBaseStats.iDurationBase + e.iDurationBonus;
      newMagnitude *= e.fMagnitudeFactor;
    });

    if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect DATA\\DATA\\Flags', 'No Duration')) {
      xelib.SetIntValue(effect, 'EFIT\\Duration', newDuration);
    }

    if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect DATA\\DATA\\Flags', 'No Magnitude')) {
      newMagnitude = Math.max(1.0, newMagnitude);
      xelib.SetIntValue(effect, 'EFIT\\Magnitude', newMagnitude);
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

class ProjectilePatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, helpers, settings, locals) {
    if (!settings.patchProjectiles) {
      return false;
    }

    this.patch = locals.patch;
    this.projectiles = locals.rules.projectiles;
    this.statics = locals.statics;

    return {
      signature: 'AMMO',
      filter: (ammo) => {
        const name = xelib.FullName(ammo);
        if (!name) { return false; }
        if (this.projectiles.excluded_ammunition.find((ex) => name.includes(ex))) { return false; }
        if (!this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier))) { return false; }

        return true;
      }
    }
  }

  patch(ammo, helpers, settings, locals) {
    this.patchStats(ammo);
    this.addVariants(ammo);
  }

  patchStats(ammo) {
    const name = xelib.FullName(ammo);
    let {newGravity, newSpeed, newRange, newDamage, failed } = this.calculateProjectileStats(name);

    if (failed) { return; }

    const oldProjectile = xelib.GetLinksTo(ammo, 'DATA\\Projectile');
    const newProjectile = xelib.CopyElement(oldProjectile, this.patch, true);

    xelib.AddElementValue(newProjectile, 'EDID', `REP_PROJ_${name}`);
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

    this.projectiles.base_stats.forEach((bs) => {
      if (name.includes(bs.sIdentifier)) {
        newGravity = bs.fGravityBase;
        newSpeed = bs.fSpeedBase;
        newRange = bs.fRangeBase;
        newDamage = bs.iDamageBase;
      }
    });

    this.projectiles.material_stats.forEach((ms) => {
      if (name.includes(ms.sMaterialName)) {
        newGravity += ms.fGravityModifier;
        newSpeed += ms.fSpeedModifier;
        newDamage += ms.iDamageModifier;
      }
    });

    this.projectiles.modifier_stats.forEach((ms) => {
      if (name.includes(ms.sModifierName)) {
        newGravity += ms.fGravityModifier;
        newSpeed += ms.fSpeedModifier;
        newDamage += ms.iDamageModifier;
      }
    });

    failed = newGravity <= 0 || newSpeed <= 0 || newRange <= 0 || newDamage <= 0;

    return { newGravity, newSpeed, newRange, newDamage, failed };
  }

  addVariants(ammo) {
    const name = xelib.FullName(ammo);

    if (this.projectiles.excluded_ammunition_variants.find((v) => name.includes(v))) {
      return;
    }

    this.multiplyArrows(ammo);
    this.multiplyBolts(ammo);
  }

  multiplyArrows(ammo) {
    const name = xelib.FullName(ammo);

    if (this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier) && bs.sType !== 'ARROW')) {
      return;
    }

    this.createVariants(ammo);
  }

  multiplyBolts(ammo) {
    const name = xelib.FullName(ammo);

    if (this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier) && bs.sType !== 'BOLT')) {
      return;
    }

    this.createVariants(ammo);

    const secondaryIngredients = [];
    const requiredPerks = [];
    const strongAmmo = this.createStrongAmmo(ammo);
    secondaryIngredients.push(this.statics.ingotIron);
    requiredPerks.push(this.statics.perkMarksmanshipAdvancedMissilecraft0);
    this.addCraftingRecipe(ammo, strongAmmo, secondaryIngredients, requiredPerks);
    this.createVariants(strongAmmo);

    secondaryIngredients.length = 0;
    requiredPerks.length = 0;
    const strongestAmmo = this.createStrongestAmmo(ammo);
    secondaryIngredients.push(this.statics.ingotSteel);
    secondaryIngredients.push(this.statics.ingotIron);
    requiredPerks.push(this.statics.perkMarksmanshipAdvancedMissilecraft0);
    this.addCraftingRecipe(ammo, strongestAmmo, secondaryIngredients, requiredPerks);
    this.createVariants(strongestAmmo);
  }

  createStrongAmmo(ammo) {
    const name = xelib.FullName(ammo);
    const strongAmmo = xelib.CopyElement(ammo, this.patch, true);
    xelib.AddElementValue(strongAmmo, 'EDID', `REP_${name} - Strong`);
    xelib.AddElementValue(strongAmmo, 'FULL', `${name} - Strong`);
    this.patchStats(strongAmmo);

    return strongAmmo;
  }

  createStrongestAmmo(ammo) {
    const name = xelib.FullName(ammo);
    const strongestAmmo = xelib.CopyElement(ammo, this.patch, true);
    xelib.AddElementValue(strongestAmmo, 'EDID', `REP_${name} - Strongest`);
    xelib.AddElementValue(strongestAmmo, 'FULL', `${name} - Strongest`);
    this.patchStats(strongestAmmo);

    return strongestAmmo;
  }

  createExplodingAmmo(ammo) {
    const desc = 'Explodes upon impact, dealing 60 points of non-elemental damage.';
    return this.createExplosiveAmmo(ammo, this.statics.expExploding, 'Explosive', desc);
  }

  createTimebombAmmo(ammo) {
    const timer = 3;
    const name = xelib.FullName(ammo);
    const timebombAmmo = xelib.CopyElement(ammo, this.patch, true);
    xelib.AddElementValue(timebombAmmo, 'EDID', `REP_${name} - Timebomb`);
    xelib.AddElementValue(timebombAmmo, 'FULL', `${name} - Timebomb`);
    xelib.AddElementValue(timebombAmmo, 'DESC', 'Explodes 3 seconds after being fired into a surface, dealing 150 points of non-elemental damage.');
    this.patchStats(timebombAmmo);

    const projectile = xelib.GetLinksTo(timebombAmmo, 'DATA\\Projectile');
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
    const name = xelib.FullName(ammo);
    const lightsourceAmmo = xelib.CopyElement(ammo, this.patch, true);
    xelib.AddElementValue(lightsourceAmmo, 'EDID', `REP_${name} - Lightsource`);
    xelib.AddElementValue(lightsourceAmmo, 'FULL', `${name} - Lightsource`);
    xelib.AddElementValue(lightsourceAmmo, 'DESC', 'Emits light after being fired.');
    this.patchStats(lightsourceAmmo);

    const projectile = xelib.GetLinksTo(lightsourceAmmo, 'DATA\\Projectile');
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
    const name = xelib.FullName(ammo);
    const newAmmo = xelib.CopyElement(ammo, this.patch, true);
    xelib.AddElementValue(newAmmo, 'EDID', `REP_${name} - ${type}`);
    xelib.AddElementValue(newAmmo, 'FULL', `${name} - ${type}`);
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

    const name = xelib.FullName(ammo);
    if (this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier) && bs.sType !== 'ARROW')) {
      this.createCrossbowOnlyVariants(ammo);
    }
  }

  createCrossbowOnlyVariants(ammo) {
    const name = xelib.FullName(ammo);
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
    const newAmmoName = xelib.FullName(newAmmo);

    const newRecipe = xelib.AddElement(this.patch, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_AMMO_${newAmmoName}`);

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
        new ArmorPatcher(),
        new AlchemyPatcher(),
        new ProjectilePatcher()
      ],

      finalize: this.finalize.bind(this)
    };
  }

  initialize(patch, helpers, settings$$1, locals) {
    this.start = new Date();
    console.log(`started patching: ${this.start}`);

    locals.patch = patch;
    this.buildRules(locals);
    this.loadStatics(locals);
    locals.cobj = helpers.loadRecords('COBJ');
    locals.refinedSilverWeapons = helpers.loadRecords('WEAP').filter((w) => {
      if (!xelib.HasElement(w, 'KWDA')) { return; }
      return xelib.HasArrayItem(w, 'KWDA', '', locals.statics.kwWeapMaterialSilverRefined);
    });
  }

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
      return xelib.Hex((loadOrder << 24) | formId);
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
      gmstfArmorScalingFactor: GetHex(0x021a72, 'Skyrim.esm'),
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
      kwArmorMaterialOrcish: GetHex(0x06BBE5, "Skyrim.esm"),
      kwArmorMaterialNordicHeavy: GetHex(0x024105, "Dragonborn.esm"),
      kwArmorMaterialScaled: GetHex(0x06BBDE, "Skyrim.esm"),
      kwArmorMaterialSteel: GetHex(0x06BBE6, "Skyrim.esm"),
      kwArmorMaterialSteelPlate: GetHex(0x06BBE7, "Skyrim.esm"),
      kwArmorMaterialStormcloak: GetHex(0x0AC13A, "Skyrim.esm"),
      kwArmorMaterialStudded: GetHex(0x06BBDF, "Skyrim.esm"),
      kwArmorMaterialVampire: GetHex(0x01463E, "Dawnguard.esm"),
      kwArmorShieldHeavy: GetHex(0x08F265, "SkyRe_Main.esp"),
      kwArmorShieldLight: GetHex(0x08F266, "SkyRe_Main.esp"),
      kwCraftingSmelter: GetHex(0x00A5CCE, "Skyrim.esm"),
      kwCraftingSmithingArmorTable: GetHex(0x0ADB78, "Skyrim.esm"),
      kwCraftingSmithingForge: GetHex(0x088105, "Skyrim.esm"),
      kwCraftingSmithingSharpeningWheel: GetHex(0x088108, "Skyrim.esm"),
      kwCraftingTanningRack: GetHex(0x07866A, "Skyrim.esm"),
      kwMasqueradeBandit: GetHex(0x03A8AA, "SkyRe_Main.esp"),
      kwMasqueradeForsworn: GetHex(0x03A8A9, "SkyRe_Main.esp"),
      kwMasqueradeImperial: GetHex(0x037D31, "SkyRe_Main.esp"),
      kwMasqueradeStormcloak: GetHex(0x037D2F, "SkyRe_Main.esp"),
      kwMasqueradeThalmor: GetHex(0x037D2B, "SkyRe_Main.esp"),
      kwWeapMaterialSilverRefined: GetHex(0x24f987, "SkyRe_Main.esp"),

      // Lights
      lightLightsource: GetHex(0x03A335, "SkyRe_Main.esp"),

      // Perks
      perkAlchemyFuse: GetHex(0x00FEDA, "SkyRe_Main.esp"),
      perkAlchemyAdvancedExplosives: GetHex(0x00fED9, "SkyRe_Main.esp"),
      perkDreamclothBody: GetHex(0x5CDA5, "SkyRe_Main.esp"),
      perkDreamclothHands: GetHex(0x5CDA8, "SkyRe_Main.esp"),
      perkDreamclothHead: GetHex(0x5CDA4, "SkyRe_Main.esp"),
      perkDreamclothFeet: GetHex(0x5CDA7, "SkyRe_Main.esp"),
      perkEnchantingElementalBombard0: GetHex(0x0AF659, "SkyRe_Main.esp"),
      perkEnchantingElementalBombard1: GetHex(0x3DF04E, "SkyRe_Main.esp"),

      perkMarksmanshipAdvancedMissilecraft0: GetHex(0x0AF670, "SkyRe_Main.esp"),
      perkMarksmanshipAdvancedMissilecraft1: GetHex(0x0AF6A4, "SkyRe_Main.esp"),
      perkMarksmanshipAdvancedMissilecraft2: GetHex(0x3DF04D, "SkyRe_Main.esp"),
      perkSmithingAdvanced: GetHex(0x0CB414, "Skyrim.esm"),
      perkSmithingArcaneBlacksmith: GetHex(0x05218E, "Skyrim.esm"),
      perkSmithingDaedric: GetHex(0x0CB413, "Skyrim.esm"),
      perkSmithingDragon: GetHex(0x052190, "Skyrim.esm"),
      perkSmithingDwarven: GetHex(0x0CB40E, "Skyrim.esm"),
      perkSmithingEbony: GetHex(0x0CB412, "Skyrim.esm"),
      perkSmithingElven: GetHex(0x0CB40F, "Skyrim.esm"),
      perkSmithingGlass: GetHex(0x0CB411, "Skyrim.esm"),
      perkSmithingLeather: GetHex(0x1D8BE6, "SkyRe_Main.esp"),
      perkSmithingOrcish: GetHex(0x0CB410, "Skyrim.esm"),
      perkSmithingSilver: GetHex(0x0581E2, "Skyrim.esm"),
      perkSmithingSilverRefined: GetHex(0x054FF5, "SkyRe_Main.esp"),
      perkSmithingSteel: GetHex(0x0CB40D, "Skyrim.esm"),
      perkSmithingMeltdown: GetHex(0x058F75, "Skyrim.esm"),
      perkSmithingWeavingMill: GetHex(0x05C827, "SkyRe_Main.esp"),
      perkSneakThiefsToolbox0: GetHex(0x037D35, "SkyRe_Main.esp")
    };

    console.log(statics);
  }

  finalize(patch, helpers, settings$$1, locals) {
    const end = new Date();
    console.log(`finished patching: ${end}`);
    console.log(Math.abs(this.start - end) / 1000 + 's');
  }

  buildRules(locals) {
    const rules = locals.rules = {};

    xelib.GetLoadedFileNames().forEach((plugin) => {
      const data = fh.loadJsonFile(`modules/reproccer-reborn/data/${plugin.slice(0, -4)}.json`, null);
      Object.deepAssign(rules, data);
    });
  }
}

registerPatcher(new ReproccerReborn(fh, info));
