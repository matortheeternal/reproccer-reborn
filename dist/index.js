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

  load(plugin, settings, locals) {
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
        if (xelib.HasArrayItem(armor, 'KWDA', '', 'VendorItemClothing')) { return true; }
        if (xelib.HasArrayItem(armor, 'KWDA', '', 'Jewelry')) { return false; }

        if (!(xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorHeavy') ||
              xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorLight') ||
              xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorSlotShield'))) {
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
    // console.log(`1 point of armor provides ${this.statics.gmstfArmorScalingFactor}% protection now.`);

    const fMaxArmorRatingBaseRecord = xelib.GetRecord(0, parseInt(this.statics.gmstfMaxArmorRating, 16));
    const fMaxArmorRating = xelib.CopyElement(fMaxArmorRatingBaseRecord, this.patchFile);
    xelib.SetFloatValue(fArmorScalingFactor, 'DATA\\Float', this.settings.armorBaseStats.fMaxProtection);
    // console.log(`Maximum armor protection: ${this.settings.armorBaseStats.fMaxProtection}%`);
  }

  patch(armor, settings, locals) {
    const name = xelib.FullName(armor);

    if (xelib.HasElement(armor, 'TNAM')) {
      // console.log(`${name}: Has template.`);
      this.patchShieldWeight(armor);
      return;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', 'VendorItemClothing')) {
      // console.log(`${name}: Started patching.`);
      this.patchMasqueradeKeywords(armor);
      this.processClothing(armor);
      // console.log(`${name}: Finished patching.`);
      return;
    }

    // console.log(`${name}: Started patching.`);
    this.overrideMaterialKeywords(armor);
    this.patchMasqueradeKeywords(armor);
    this.patchArmorRating(armor);
    this.patchShieldWeight(armor);
    this.modifyTemperingRecipe(armor);
    this.addMeltdownRecipe(armor);
    this.modifyLeatherCraftingRecipe(armor);
    // console.log(`${name}: Finished patching.`);
  }

  patchShieldWeight(armor) {
    const name = xelib.FullName(armor);

    if (!xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorShield')) {
      return;
    }

    if (this.hasHeavyMaterialKeyword(armor)) {
      const keyword = xelib.AddElement(armor, 'KWDA\\.', this.statics.kwArmorShieldHeavy);

      if (!name.includes('Heavy Shield')) {
        xelib.AddElementValue(armor, 'FULL', name.replace('Shield', 'Heavy Shield'));
      }

      // console.log(`${name}: Categorized as heavy shield`);
    } else {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwArmorShieldLight);

      if (!name.includes('Light Shield')) {
        xelib.AddElementValue(armor, 'FULL', name.replace('Shield', 'Light Shield'));
      }

      // console.log(`${name}: Categorized as light shield`);
    }
  }

  hasHeavyMaterialKeyword(armor) {
    return xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialBladesDUPLICATE001') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDraugr') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialIron') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDwarven') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialOrcish') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialFalmerDUPLICATE001') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'DLC1ArmorMaterialFalmerHeavyOriginal') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDaedric') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialEbony') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'DLC1ArmorMaterialDawnguard') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialImperialHeavy') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialSteel') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialIronBanded') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDragonplate') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialSteelPlate');
  }

  patchMasqueradeKeywords(armor) {
    const name = xelib.FullName(armor);

    if (name.includes('Thalmor')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeThalmor);
      // console.log(`${name}: Added Thalmor Masquerade keyword.`);
    }

    if (name.includes('Bandit') || name.includes('Fur')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeBandit);
      // console.log(`${name}: Added Bandit Masquerade keyword.`);
    }

    if (name.includes('Imperial')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeImperial);
      // console.log(`${name}: Added Imperial Masquerade keyword.`);
    }

    if (name.includes('Stormcloak')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeStormcloak);
      // console.log(`${name}: Added Stormcloak Masquerade keyword.`);
    }

    if (name.includes('Forsworn') || name.includes('Old God')) {
      xelib.AddElement(armor, 'KWDA\\.', this.statics.kwMasqueradeForsworn);
      // console.log(`${name}: Added Forsworn Masquerade keyword.`);
    }
  }

  processClothing(armor) {
    const name = xelib.FullName(armor);

    this.addClothingMeltdownRecipe(armor);

    if (name.includes('Dreamcloth')) {
      // console.log(`${name}: Dreamcloth excluded.`);
      return;
    }

    if (xelib.HasElement(armor, 'EITM')) {
      // console.log(`${name}: Enchanted. No dreamcloth generated.`);
      return;
    }

    const dreamcloth = this.createDreamcloth(armor);
    if (!dreamcloth) {
      // console.log(`${name}: Failed to generate dreamcloth variant.`);
      return;
    }

    this.addClothingCraftingRecipe(dreamcloth, true);
    this.addClothingMeltdownRecipe(dreamcloth, true);
  }

  createDreamcloth(armor) {
    const name = xelib.FullName(armor);
    let dreamclothPerk;

    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingBody')) {
      dreamclothPerk = this.statics.perkDreamclothBody;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingHands')) {
      dreamclothPerk = this.statics.perkDreamclothHands;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingHead')) {
      dreamclothPerk = this.statics.perkDreamclothHead;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingFeet')) {
      dreamclothPerk = this.statics.perkDreamclothFeet;
    } else {
      // console.log(`${name}: Flagged as clothing but lacking slot keywords.  No dreamcloth generated`);
      return null;
    }

    if (!dreamclothPerk) {
      // console.log(`${name}: Could not find which perk to assign.  No dreamcloth generated`);
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
    // console.log(`${newName}: Generated`);

    return newDreamcloth;
  }

  addClothingMeltdownRecipe(armor, isDreamCloth) {
    const name = xelib.FullName(armor);
    let returnQuantity = 1;
    let inputQuantity = 1;

    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingBody')) {
      returnQuantity += 2;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingHands') || xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingHead') || xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingFeet')) {
      returnQuantity++;
    } else {
      // console.log(`${name}: Couldn't find slot.  Meltdown recipe might be inappropriate.`);
    }

    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_MELTDOWN_CLOTHING_${name}`);

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetIntValue(ingredient, 'CNTO\\Count', inputQuantity);
    xelib.AddElementValue(newRecipe, 'NAM1', `${returnQuantity}`);
    xelib.AddElementValue(newRecipe, 'CNAM', this.statics.leatherStrips);
    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingTanningRack);

    xelib.AddElement(newRecipe, 'Conditions');
    const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
    updateHasPerkCondition(newRecipe, condition, 10000000, 1, this.statics.perkSmithingMeltdown);

    if (isDreamCloth) {
      createHasPerkCondition(newRecipe, 10000000, 1, this.statics.perkSmithingWeavingMill);
      const condition2 = xelib.AddElement(newRecipe, 'Conditions\\.');
    }

    createGetItemCountCondition(newRecipe, 11000000, 1, armor);

    // console.log(`${name}: Added meltdown recipe.`);
  }

  addClothingCraftingRecipe(armor, isDreamCloth) {
    const name = xelib.FullName(armor);
    const newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
    xelib.AddElementValue(newRecipe, 'EDID', `REP_CRAFT_CLOTHING_${name}`);

    let quantityIngredient1 = 2;

    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingBody')) {
      quantityIngredient1 += 2;
    } else if (xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingHead')) {
      quantityIngredient1++;
    } else if (!xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingHands') && !xelib.HasArrayItem(armor, 'KWDA', '', 'ClothingFeet')) {
      // console.log(`${name}: Couldn't find slot.  Crafting recipe might be inappropriate.`);
    }

    xelib.AddElement(newRecipe, 'Items');
    const ingredient = xelib.AddElement(newRecipe, 'Items\\[0]');
    xelib.SetValue(ingredient, 'CNTO\\Item', this.statics.leather);
    xelib.SetIntValue(ingredient, 'CNTO\\Count', quantityIngredient1);
    xelib.AddElementValue(newRecipe, 'NAM1', '1');
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(armor));
    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingTanningRack);

    const secondaryIngredients = [];
    secondaryIngredients.push(this.statics.leatherStrips);

    if (isDreamCloth) {
      secondaryIngredients.push(this.statics.pettySoulGem);

      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.AddElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, this.statics.perkSmithingWeavingMill);
    }

    secondaryIngredients.forEach((hexcode) => {
      const ingredient = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(ingredient, 'CNTO\\Item', hexcode);
      xelib.SetIntValue(ingredient, 'CNTO\\Count', 1);
    });

    // console.log(`${name}: Added crafting recipe.`);
  }

  overrideMaterialKeywords(armor) {
    const name = xelib.FullName(armor);
    const override = this.getArmorMaterialOverride(name);

    if (!override) {
      // console.log(`${name}: No material override specified.`);
      return;
    }

    // console.log(`${name}: Material override: ${override}`);

    if (this.hasMaterialKeyword(armor)) {
      // console.log(`${name}: Has override ${override}, but already carries keyword.  Override ignored.`);
      return;
    }

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

    // console.log(`${name}: Couldn't map override ${override} to any material.`);
  }

  getArmorMaterialOverride(name) {
    const override = this.armor.material_overrides.find((o) => name.includes(o.armorSubstring));
    return override ? override.materialOverride : null;
  }

  hasMaterialKeyword(armor) {
    return xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDaedric') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialSteel') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialIron') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDwarven') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialFalmerDUPLICATE001') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialOrcish') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialEbony') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialSteelPlate') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDragonplate') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialFur') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialHide') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialLeather') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialElven') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialScaled') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialGlass') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialDragonscale') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'DLC2ArmorMaterialNordicHeavy') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'DLC2ArmorMaterialStalhrimHeavy') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'DLC2ArmorMaterialStalhrimLight') ||
           xelib.HasArrayItem(armor, 'KWDA', '', 'DLC2ArmorMaterialBonemoldHeavy');
  }

  patchArmorRating(armor) {
    const rating = this.getArmorSlotMultiplier(armor) * this.getMaterialArmorModifier(armor);
    xelib.SetFloatValue(armor, 'DNAM', rating);
    // console.log(`${xelib.FullName(armor)} - new armor rating: ${rating}`);
  }

  getArmorSlotMultiplier(armor) {
    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorBoots')) { return this.settings.armorBaseStats.fArmorFactorBoots; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorCuirass')) { return this.settings.armorBaseStats.fArmorFactorCuirass; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorGauntlets')) { return this.settings.armorBaseStats.fArmorFactorGauntlets; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorHelmet')) { return this.settings.armorBaseStats.fArmorFactorHelmet; }
    if (xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorShield')) { return this.settings.armorBaseStats.fArmorFactorShield; }

    // console.log(`${xelib.FullName(armor)}: Couldn't determine slot.`);
    return 0;
  }

  getMaterialArmorModifier(armor) {
    const name = xelib.FullName(armor);
    let armorRating = getValueFromName(this.armor.materials, name, 'name', 'iArmor');

    if (armorRating !== null) { return armorRating; }

    // console.log(`${name}: Material not classified by name.  Trying keywords instead.`);

    this.armor.keyword_material_map.every((pair) => {
      if (xelib.HasArrayItem(armor, 'KWDA', '', pair.sKeyword)) {
        armorRating = getValueFromName(this.armor.materials, name, 'name', 'iArmor');
        return false;
      }
    });

    if (armorRating !== null) { return armorRating; }

    // console.log(`${name}: Failed to find material armor base.`);
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
    const kwda = function(kwda) { return xelib.HasArrayItem(armor, 'KWDA', '', kwda); };
    let perk;

         if (kwda('ArmorMaterialDaedric'))                             { perk = this.statics.perkSmithingDaedric;  }
    else if (kwda('ArmorMaterialDragonplate') || kwda('ArmorMaterialDragonscale'))  { perk = this.statics.perkSmithingDragon;   }
    else if (kwda('ArmorMaterialDraugr'))                              { perk = this.statics.perkSmithingSteel;    }
    else if (kwda('ArmorMaterialDwarven'))                             { perk = this.statics.perkSmithingDwarven;  }
    else if (kwda('ArmorMaterialEbony'))                               { perk = this.statics.perkSmithingEbony;    }
    else if (kwda('ArmorMaterialElven')  || kwda('ArmorMaterialElvenGilded'))       { perk = this.statics.perkSmithingElven;    }
    else if (kwda('ArmorMaterialFalmerDUPLICATE001') || kwda('DLC1ArmorMaterialFalmerHardened') || kwda('DLC1ArmorMaterialFalmerHeavy') || kwda('DLC1ArmorMaterialFalmerHeavyOriginal')) {
      perk = this.statics.perkSmithingAdvanced;
    }
    else if (kwda('ArmorMaterialGlass')) { perk = this.statics.perkSmithingGlass; }
    else if (kwda('ArmorMaterialImperialLight') || kwda('ArmorMaterialImperialStudded') || kwda('DLC1ArmorMaterialDawnguard') || kwda('DLC1ArmorMaterialHunter')) {
      perk = this.statics.perkSmithingSteel;
    }
    else if (!kwda('ArmorMaterialIron') && !kwda('ArmorMaterialStormcloak') && !kwda('ArmorMaterialIronBanded'))
    {
           if (kwda('ArmorMaterialOrcish'))  { perk = this.statics.perkSmithingOrcish; }
      else if (kwda('ArmorMaterialBladesDUPLICATE001'))  { perk = this.statics.perkSmithingSteel;  }
      else if (kwda('ArmorMaterialSteel'))   { perk = this.statics.perkSmithingSteel;  }
      else if (kwda('ArmorMaterialLeather') || kwda('ArmorNightingale') || kwda('ArmorDarkBrotherhood')) {
        perk = this.statics.perkSmithingLeather;
      }
      else if (!kwda('ArmorMaterialHide') && !kwda('ArmorMaterialFur')) {
        if (kwda('ArmorMaterialSteelPlate') || kwda('ArmorMaterialScaled') || kwda('DLC2ArmorMaterialStalhrimLight') || kwda('DLC2ArmorMaterialStalhrimHeavy') || kwda('DLC2ArmorMaterialBonemoldHeavy') || kwda('DLC2ArmorMaterialNordicHeavy')) {
          perk = this.statics.perkSmithingAdvanced;
        }
      }
    }

    // console.log(`${xelib.FullName(armor)}: Couldn't determine material - tempering recipe not modified.`);
    return perk;
  }

  modifyLeatherCraftingRecipe(armor, recipe) {
    if (!xelib.HasArrayItem(armor, 'KWDA', '', 'ArmorMaterialLeather')) { return; }

    // console.log(`${xelib.FullName(armor)}: Trying to add leather requirements.`);

    const cnam = xelib.GetLinksTo(recipe, 'CNAM');
    if (!cnam || !xelib.ElementEquals(cnam, armor)) { return; }

    const newRecipe = xelib.CopyElement(recipe, this.patchFile);
    createHasPerkCondition(newRecipe, 10000000, 1, this.statics.perkSmithingLeather);
  }

  addMeltdownRecipe(armor) {
    const name = xelib.FullName(armor);
    const statics = this.statics;
    const kwda = function(kwda) { return xelib.HasArrayItem(armor, 'KWDA', '', kwda); };
    const incr = function(v) { return v++; };
    const noop = function(v) { return v; };
    const keywordMap = [
      { kwda: 'ArmorDarkBrotherhood',             cnam: statics.leatherStrips,    perk: statics.perkSmithingLeather,  bnam: statics.kwCraftingTanningRack, func: incr  },
      { kwda: 'ArmorMaterialBladesDUPLICATE001',  cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialDaedric',             cnam: statics.ingotEbony,       perk: statics.perkSmithingDaedric,  bnam: statics.kwCraftingSmelter    , func: incr  },
      { kwda: 'ArmorMaterialDragonplate',         cnam: statics.dragonbone,       perk: statics.perkSmithingDragon,   bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialDragonscale',         cnam: statics.dragonscale,      perk: statics.perkSmithingDragon,   bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialDwarven',             cnam: statics.ingotDwarven,     perk: statics.perkSmithingDwarven,  bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialEbony',               cnam: statics.ingotEbony,       perk: statics.perkSmithingEbony,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialElven',               cnam: statics.ingotMoonstone,   perk: statics.perkSmithingElven,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialElvenGilded',         cnam: statics.ingotMoonstone,   perk: statics.perkSmithingElven,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialFalmerDUPLICATE001',  cnam: statics.chaurusChitin,    perk: null,                         bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialFur',                 cnam: statics.leatherStrips,    perk: null,                         bnam: statics.kwCraftingTanningRack, func: noop  },
      { kwda: 'ArmorMaterialHide',                cnam: statics.leatherStrips,    perk: null,                         bnam: statics.kwCraftingTanningRack, func: noop  },
      { kwda: 'ArmorMaterialGlass',               cnam: statics.ingotMalachite,   perk: statics.perkSmithingGlass,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialImperialHeavy',       cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialImperialLight',       cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialImperialStudded',     cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialIron',                cnam: statics.ingotIron,        perk: null,                         bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialLeather',             cnam: statics.leatherStrips,    perk: statics.perkSmithingLeather,  bnam: statics.kwCraftingTanningRack, func: incr  },
      { kwda: 'ArmorMaterialOrcish',              cnam: statics.ingotOrichalcum,  perk: statics.perkSmithingOrcish,   bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialScaled',              cnam: statics.ingotCorundum,    perk: statics.perkSmithingAdvanced, bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialSteel',               cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialSteelPlate',          cnam: statics.ingotCorundum,    perk: statics.perkSmithingAdvanced, bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorMaterialStormcloak',          cnam: statics.ingotIron,        perk: null,                         bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'ArmorNightingale',                 cnam: statics.leatherStrips,    perk: statics.perkSmithingLeather,  bnam: statics.kwCraftingTanningRack, func: incr  },
      { kwda: 'DLC1ArmorMaterialDawnguard',       cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC1ArmorMaterialHunter',          cnam: statics.ingotSteel,       perk: statics.perkSmithingSteel,    bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC1ArmorMaterialFalmerHardened',  cnam: statics.chaurusChitin,    perk: null,                         bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC1ArmorMaterialFalmerHeavy',     cnam: statics.chaurusChitin,    perk: null,                         bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC2ArmorMaterialBonemoldHeavy',   cnam: statics.netchLeather,     perk: statics.perkSmithingAdvanced, bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC2ArmorMaterialNordicHeavy',     cnam: statics.ingotQuicksilver, perk: statics.perkSmithingAdvanced, bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC2ArmorMaterialStalhrimHeavy',   cnam: statics.oreStalhrim,      perk: statics.perkSmithingAdvanced, bnam: statics.kwCraftingSmelter    , func: noop  },
      { kwda: 'DLC2ArmorMaterialStalhrimLight',   cnam: statics.oreStalhrim,      perk: statics.perkSmithingAdvanced, bnam: statics.kwCraftingSmelter    , func: noop  }
    ];

    let outputQuantity = 1;
    let inputQuantity = 1;
    let cnam;
    let perk;
    let bnam;

    if (kwda('ArmorCuirass') || kwda('ArmorShield')) {
      outputQuantity++;
    }

    if (kwda('ArmorMaterialDraugr')) {
      cnam = this.statics.dragonScale;
      bnam = statics.kwCraftingSmelter;
      perk = this.statics.perkSmithingSteel;
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
      // console.log(`${name}: Couldn't determine material - no meltdown recipe generated.`);
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

    // console.log(`${name}: Added meltdown recipe.`);
  }
}

class AlchemyPatcher {
  constructor() {
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  load(plugin, settings, locals) {
    this.alchemy = locals.rules.alchemy;
    this.settings = settings;

    if (!settings.patchAlchemyIngredients) {
      return false;
    }

    return {
      signature: 'INGR'
    }
  }

  patch(ingredient, settings, locals) {
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

  load(plugin, settings, locals) {
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

  patch(ammo, settings, locals) {
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
    const secondaryIngredients = [];
    const requiredPerks = [];

    const explodingAmmo = this.createExplodingAmmo(ammo);
    secondaryIngredients.push(this.statics.ale);
    secondaryIngredients.push(this.statics.torchbugThorax);
    requiredPerks.push(this.statics.perkAlchemyFuse);
    this.addCraftingRecipe(ammo, explodingAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const timebombAmmo = this.createTimebombAmmo(ammo);
    secondaryIngredients.push(this.statics.fireSalt);
    secondaryIngredients.push(this.statics.torchbugThorax);
    requiredPerks.push(this.statics.perkAlchemyAdvancedExplosives);
    this.addCraftingRecipe(ammo, timebombAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const lightsourceAmmo = this.createLightsourceAmmo(ammo);
    secondaryIngredients.push(this.statics.torchbugThorax);
    secondaryIngredients.push(this.statics.leatherStrips);
    requiredPerks.push(this.statics.perkSneakThiefsToolbox0);
    this.addCraftingRecipe(ammo, lightsourceAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const noisemakerAmmo = this.createNoisemakerAmmo(ammo);
    secondaryIngredients.push(this.statics.pettySoulGem);
    secondaryIngredients.push(this.statics.boneMeal);
    requiredPerks.push(this.statics.perkSneakThiefsToolbox0);
    this.addCraftingRecipe(ammo, noisemakerAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const name = xelib.FullName(ammo);
    if (this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier) && bs.sType !== 'ARROW')) {
      this.createCrossbowOnlyVariants(ammo);
    }
  }

  createCrossbowOnlyVariants(ammo) {
    const name = xelib.FullName(ammo);
    const secondaryIngredients = [];
    const requiredPerks = [];

    const fireAmmo = this.createFireAmmo(ammo);
    secondaryIngredients.push(this.statics.pettySoulGem);
    secondaryIngredients.push(this.statics.fireSalt);
    requiredPerks.push(this.statics.perkEnchantingElementalBombard0);
    this.addCraftingRecipe(ammo, fireAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const frostAmmo = this.createFrostAmmo(ammo);
    secondaryIngredients.push(this.statics.pettySoulGem);
    secondaryIngredients.push(this.statics.frostSalt);
    requiredPerks.push(this.statics.perkEnchantingElementalBombard0);
    this.addCraftingRecipe(ammo, frostAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const shockAmmo = this.createShockAmmo(ammo);
    secondaryIngredients.push(this.statics.pettySoulGem);
    secondaryIngredients.push(this.statics.voidSalt);
    requiredPerks.push(this.statics.perkEnchantingElementalBombard0);
    this.addCraftingRecipe(ammo, shockAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const neuralgiaAmmo = this.createNeuralgiaAmmo(ammo);
    secondaryIngredients.push(this.statics.pettySoulGem);
    secondaryIngredients.push(this.statics.deathBell);
    requiredPerks.push(this.statics.perkEnchantingElementalBombard1);
    this.addCraftingRecipe(ammo, neuralgiaAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const barbedAmmo = this.createBarbedAmmo(ammo);
    secondaryIngredients.push(this.statics.ingotSteel);
    secondaryIngredients.push(this.statics.deathBell);
    requiredPerks.push(this.statics.perkMarksmanshipAdvancedMissilecraft1);
    this.addCraftingRecipe(ammo, barbedAmmo, secondaryIngredients, requiredPerks);
    secondaryIngredients.length = 0;
    requiredPerks.length = 0;

    const heavyweightAmmo = this.createHeavyweightAmmo(ammo);
    secondaryIngredients.push(this.statics.ingotSteel);
    secondaryIngredients.push(this.statics.boneMeal);
    requiredPerks.push(this.statics.perkMarksmanshipAdvancedMissilecraft2);
    this.addCraftingRecipe(ammo, heavyweightAmmo, secondaryIngredients, requiredPerks);
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

      xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
      xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
      xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
      xelib.SetValue(condition, 'CTDA\\Perk', perk);
      xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
    });

    const condition = xelib.AddElement(newRecipe, 'Conditions\\.');
    xelib.SetIntValue(condition, 'CTDA\\Type', 11000000);
    xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', ammoReforgeInputCount);
    xelib.SetValue(condition, 'CTDA\\Function', 'GetItemCount');
    xelib.SetValue(condition, 'CTDA\\Inventory Object', xelib.GetHexFormID(baseAmmo));
    xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
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
    locals.patch = patch;
    this.buildRules(locals);
    this.loadStatics(locals);
    locals.cobj = helpers.LoadRecords('COBJ');
    locals.refinedSilverWeapons = helpers.LoadRecords('WEAP').filter((w) => {
      if (!xelib.HasElement(w, 'KWDA')) { return; }
      return xelib.HasArrayItem(w, 'KWDA', '', locals.statics.kwWeapMaterialSilverRefined);
    });

    console.log(`started patching: ${this.start}`);
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

ngapp.run((patcherService) => {
  patcherService.registerPatcher(new ReproccerReborn(fh, info));
});
