export default class ArmorPatcher {
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
    this.cobj = locals.cobj

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

    // TODO: Fix adding dream cloth perk script
    // this.addDreamClothPerkScript(newDreamcloth, dreamclothPerk);
    // console.log(`${newName}: Generated`);

    return newDreamcloth;
  }

  addDreamClothPerkScript(armor, perk) {
    const vmad = xelib.AddElement(armor, 'VMAD');
    xelib.SetIntValue(vmad, 'Version', 5);
    xelib.SetIntValue(vmad, 'Object Format', 2);

    const script = xelib.AddElement(vmad, 'Data\\Scripts\\.');
    xelib.SetValue(script, 'scriptName', 'xxxDreamcloth');
    xelib.SetFlag(script, 'Flags', 'Local', true);

    const property = xelib.AddElement(script, 'Properties\\.');
    xelib.SetValue(property, 'propertyName', 'pDream');
    xelib.SetIntValue(property, 'Type', 1);
    xelib.SetFlag(property, 'Flags', 'Edited', true);
    xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', perk);
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
    xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
    xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
    xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
    xelib.SetValue(condition, 'CTDA\\Perk', this.statics.perkSmithingMeltdown);
    xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');

    if (isDreamCloth) {
      const condition2 = xelib.AddElement(newRecipe, 'Conditions\\.');
      xelib.SetIntValue(condition2, 'CTDA\\Type', 10000000);
      xelib.SetFloatValue(condition2, 'CTDA\\Comparison Value - Float', 1);
      xelib.SetValue(condition2, 'CTDA\\Function', 'HasPerk');
      xelib.SetValue(condition2, 'CTDA\\Perk', this.statics.perkSmithingWeavingMill);
      xelib.SetValue(condition2, 'CTDA\\Run On', 'Subject');
    }

    const condition3 = xelib.AddElement(newRecipe, 'Conditions\\.');
    xelib.SetIntValue(condition3, 'CTDA\\Type', 11000000);
    xelib.SetFloatValue(condition3, 'CTDA\\Comparison Value - Float', 1);
    xelib.SetValue(condition3, 'CTDA\\Function', 'GetItemCount');
    xelib.SetValue(condition3, 'CTDA\\Inventory Object', xelib.GetHexFormID(armor));
    xelib.SetValue(condition3, 'CTDA\\Run On', 'Subject');

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
      xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
      xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
      xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
      xelib.SetValue(condition, 'CTDA\\Perk', this.statics.perkSmithingWeavingMill);
      xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
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
      IRON:           { kwda: this.statics.kwArmorMaterialIron,           perk: null                              },
      STEEL:          { kwda: this.statics.kwArmorMaterialSteel,          perk: this.statics.perkSmithingSteel    },
      DWARVEN:        { kwda: this.statics.kwArmorMaterialDwarven,        perk: this.statics.perkSmithingDwarven  },
      FALMER:         { kwda: this.statics.kwArmorMaterialFalmer,         perk: this.statics.perkSmithingAdvanced },
      ORCISH:         { kwda: this.statics.kwArmorMaterialOrcish,         perk: this.statics.perkSmithingOrcish   },
      STEELPLATE:     { kwda: this.statics.kwArmorMaterialSteelPlate,     perk: this.statics.perkSmithingAdvanced },
      EBONY:          { kwda: this.statics.kwArmorMaterialEbony,          perk: this.statics.perkSmithingEbony    },
      DRAGONPLATE:    { kwda: this.statics.kwArmorMaterialDragonPlate,    perk: this.statics.perkSmithingDragon   },
      DAEDRIC:        { kwda: this.statics.kwArmorMaterialDaedric,        perk: this.statics.perkSmithingDaedric  },
      FUR:            { kwda: this.statics.kwArmorMaterialFur,            perk: null                              },
      HIDE:           { kwda: this.statics.kwArmorMaterialHide,           perk: null                              },
      LEATHER:        { kwda: this.statics.kwArmorMaterialLeather,        perk: this.statics.perkSmithingLeather  },
      ELVEN:          { kwda: this.statics.kwArmorMaterialElven,          perk: this.statics.perkSmithingElven    },
      SCALED:         { kwda: this.statics.kwArmorMaterialScaled,         perk: this.statics.perkSmithingAdvanced },
      GLASS:          { kwda: this.statics.kwArmorMaterialGlass,          perk: this.statics.perkSmithingGlass    },
      DRAGONSCALE:    { kwda: this.statics.kwArmorMaterialDragonscale,    perk: this.statics.perkSmithingDragon   },
      STALHRIM_HEAVY: { kwda: this.statics.kwArmorMaterialStalhrimHeavy,  perk: this.statics.perkSmithingAdvanced },
      STALHRIM_LIGHT: { kwda: this.statics.kwArmorMaterialStalhrimLight,  perk: this.statics.perkSmithingAdvanced },
      NORDIC_HEAVY:   { kwda: this.statics.kwArmorMaterialNordicHeavy,    perk: this.statics.perkSmithingAdvanced },
      BONEMOLD_HEAVY: { kwda: this.statics.kwArmorMaterialNordicLight,    perk: this.statics.perkSmithingAdvanced },
    }

    if (overrideMap[override]) {
      xelib.AddElement(armor, 'KWDA\\.', overrideMap[override].kwda);
      this.overrideCraftingRecipes(armor, overrideMap[override].perk);
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

  overrideCraftingRecipes(armor, perk) {
    this.cobj.forEach((recipe) => {
      const result = xelib.GetLinksTo(recipe, 'CNAM');

      if (!result || xelib.GetHexFormID(result) !== xelib.GetHexFormID(armor)) {
        return;
      }

      const newRecipe = xelib.CopyElement(recipe, this.patchFile);
      xelib.RemoveElement(newRecipe, 'Conditions');

      if (perk) {
        xelib.AddElement(newRecipe, 'Conditions');
        const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
        xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
        xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
        xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
        xelib.SetValue(condition, 'CTDA\\Perk', perk);
        xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
      }

      // console.log(`${xelib.FullName(armor)}: Added crafting or tempering requirement.`);
    });
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
    let armorRating = this.getMaterialArmorRatingFromName(name);

    if (armorRating !== -10) { return armorRating; }

    // console.log(`${name}: Material not classified by name.  Trying keywords instead.`);

    this.armor.keyword_material_map.every((pair) => {
      if (xelib.HasArrayItem(armor, 'KWDA', '', pair.sKeyword)) {
        armorRating = this.getMaterialArmorRatingFromName(pair.sMaterialName);
        return false;
      }
    });

    if (armorRating !== -10) { return armorRating; }

    // console.log(`${name}: Failed to find material armor base.`);
    return 0;
  }

  getMaterialArmorRatingFromName(name) {
    let maxLength = 0;
    let armor = -10;

    this.armor.materials.forEach((material) => {
      if (name.includes(material.sMaterialName) && material.sMaterialName.length > maxLength) {
        armor = material.iArmor;
        maxLength = material.sMaterialName.length;
      }
    });

    return armor;
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
    xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
    xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
    xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
    xelib.SetValue(condition, 'CTDA\\Perk', perk);
    xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
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
    const condition = xelib.AddElement(newRecipe, 'Conditions\\.');
    xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
    xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
    xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
    xelib.SetValue(condition, 'CTDA\\Perk', this.statics.perkSmithingLeather);
    xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
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
    const baseItem = xelib.GetElement(recipe, 'Items\\[0]')
    xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(armor));
    xelib.SetIntValue(baseItem, 'CNTO\\Count', inputQuantity);


    xelib.AddElement(recipe, 'Conditions');
    const condition = xelib.GetElement(recipe, 'Conditions\\[0]');
    xelib.SetIntValue(condition, 'CTDA\\Type', 10000000);
    xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', 1);
    xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
    xelib.SetValue(condition, 'CTDA\\Perk', statics.perkSmithingMeltdown);
    xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');

    if (perk) {
      const condition2 = xelib.AddElement(recipe, 'Conditions\\.');
      xelib.SetIntValue(condition2, 'CTDA\\Type', 10000000);
      xelib.SetFloatValue(condition2, 'CTDA\\Comparison Value - Float', 1);
      xelib.SetValue(condition2, 'CTDA\\Function', 'HasPerk');
      xelib.SetValue(condition2, 'CTDA\\Perk', perk);
      xelib.SetValue(condition2, 'CTDA\\Run On', 'Subject');
    }

    const condition3 = xelib.AddElement(recipe, 'Conditions\\.');
    xelib.SetIntValue(condition3, 'CTDA\\Type', 11000000);
    xelib.SetFloatValue(condition3, 'CTDA\\Comparison Value - Float', 1.0);
    xelib.SetValue(condition3, 'CTDA\\Function', 'GetItemCount');
    xelib.SetValue(condition3, 'CTDA\\Inventory Object', xelib.GetHexFormID(armor));
    xelib.SetValue(condition3, 'CTDA\\Run On', 'Subject');

    // console.log(`${name}: Added meltdown recipe.`);
  }
}
