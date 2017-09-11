export default class ProjectilePatcher {
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
        if (this.projectiles.excluded_ammunition.find((ex) => name.includes(ex))) { return false; };
        if (!this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier))) { return false; }

        return true;
      }
    }
  }

  patch(ammo, settings, locals) {
    const name = xelib.FullName(ammo);
    console.log(`${name}: Started Patching`);

    this.patchStats(ammo);
    this.addVariants(ammo);

    console.log(`${name}: Stopped patching`);
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
    xelib.AddElementValue(strongAmmo, 'EDID', `REP_${name} - Strong`)
    xelib.AddElementValue(strongAmmo, 'FULL', `${name} - Strong`);
    this.patchStats(strongAmmo);

    return strongAmmo;
  }

  createStrongestAmmo(ammo) {
    const name = xelib.FullName(ammo);
    const strongestAmmo = xelib.CopyElement(ammo, this.patch, true);
    xelib.AddElementValue(strongestAmmo, 'EDID', `REP_${name} - Strongest`)
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
    xelib.AddElementValue(timebombAmmo, 'EDID', `REP_${name} - Timebomb`)
    xelib.AddElementValue(timebombAmmo, 'FULL', `${name} - Timebomb`);
    xelib.AddElementValue(timebombAmmo, 'DESC', 'Explodes 3 seconds after being fired into a surface, dealing 150 points of non-elemental damage.')
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
    xelib.AddElementValue(lightsourceAmmo, 'EDID', `REP_${name} - Lightsource`)
    xelib.AddElementValue(lightsourceAmmo, 'FULL', `${name} - Lightsource`);
    xelib.AddElementValue(lightsourceAmmo, 'DESC', 'Emits light after being fired.')
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
    xelib.AddElementValue(newAmmo, 'EDID', `REP_${name} - ${type}`)
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
    const baseItem = xelib.GetElement(newRecipe, 'Items\\[0]')
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
