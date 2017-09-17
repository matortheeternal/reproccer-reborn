import * as h from './helpers';

export default class ProjectilePatcher {
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
      filter: (record) => {
        const ammo = xelib.GetWinningOverride(record);
        const name = xelib.FullName(ammo);
        if (!name) { return false; }
        if (this.projectiles.excluded_ammunition.find((ex) => name.includes(ex))) { return false; }
        if (!this.projectiles.base_stats.find((bs) => name.includes(bs.sIdentifier))) { return false; }

        return true;
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
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

      h.updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    });

    h.createGetItemCountCondition(newRecipe, 11000000, ammoReforgeInputCount, baseAmmo);
  }
}
