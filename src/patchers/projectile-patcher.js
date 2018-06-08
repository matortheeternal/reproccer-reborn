import { createGetItemCountCondition, updateHasPerkCondition } from './helpers';

export default class ProjectilePatcher {
  names = {};

  constructor(helpers, locals, patch, settings) {
    this.patchFile = patch;
    this.rules = locals.rules.projectiles;
    this.settings = settings;
    this.statics = locals.statics;
  }

  load = {
    filter: record => {
      if (!this.settings.projectiles.enabled) {
        return false;
      }

      const name = xelib.FullName(record);

      if (!name) {
        return false;
      }

      if (this.rules.excludedAmmunition.find(ex => name.includes(ex))) {
        return false;
      }

      if (!this.rules.baseStats.find(bs => name.includes(bs.identifier))) {
        return false;
      }

      return true;
    },

    signature: 'AMMO'
  };

  patch = record => {
    this.names[record] = xelib.FullName(record);
    this.patchStats(record);
    this.addVariants(record);
  };

  patchStats(ammo) {
    const { newGravity, newSpeed, newRange, newDamage, failed } = this.calculateProjectileStats(
      this.names[ammo]
    );

    if (failed) {
      return;
    }

    const oldProjectile = xelib.GetWinningOverride(xelib.GetLinksTo(ammo, 'DATA\\Projectile'));
    const newProjectile = xelib.CopyElement(oldProjectile, this.patchFile, true);

    xelib.AddElementValue(newProjectile, 'EDID', `REP_PROJ_${this.names[ammo]}`);
    xelib.SetFloatValue(newProjectile, 'DATA\\Gravity', newGravity);
    xelib.SetFloatValue(newProjectile, 'DATA\\Speed', newSpeed);
    xelib.SetFloatValue(newProjectile, 'DATA\\Range', newRange);

    xelib.SetValue(ammo, 'DATA\\Projectile', xelib.GetHexFormID(newProjectile));
    xelib.SetUIntValue(ammo, 'DATA\\Damage', newDamage);
  }

  calculateProjectileStats(name) {
    let newGravity = 0;
    let newSpeed = 0;
    let newRange = 0;
    let newDamage = 0;
    let failed = false;

    this.rules.baseStats.some(bs => {
      if (!name.includes(bs.identifier)) {
        return false;
      }

      newGravity = bs.gravity;
      newSpeed = bs.speed;
      newRange = bs.range;
      newDamage = bs.damage;
      return true;
    });

    this.rules.materialStats.some(ms => {
      if (!name.includes(ms.name)) {
        return false;
      }

      newGravity += ms.gravity;
      newSpeed += ms.speed;
      newDamage += ms.damage;
      return true;
    });

    this.rules.modifierStats.some(ms => {
      if (!name.includes(ms.name)) {
        return false;
      }

      newGravity += ms.gravity;
      newSpeed += ms.speed;
      newDamage += ms.damage;
      return true;
    });

    failed = newGravity <= 0 || newSpeed <= 0 || newRange <= 0 || newDamage <= 0;

    return { newGravity, newSpeed, newRange, newDamage, failed };
  }

  addVariants(ammo) {
    if (this.rules.excludedAmmunitionVariants.find(v => this.names[ammo].includes(v))) {
      return;
    }

    this.createVariants(ammo);
    this.multiplyBolts(ammo);
  }

  multiplyBolts(ammo) {
    const found = this.rules.baseStats.find(
      bs => this.names[ammo].includes(bs.identifier) && bs.type !== 'BOLT'
    );

    if (found) {
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
    xelib.AddElementValue(
      timebombAmmo,
      'DESC',
      'Explodes 3 seconds after being fired into a surface, dealing 150 points of non-elemental damage.'
    );
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
    const desc =
      'Deals 6 points of bleeding damag per second over 8 seconds, and slows the target down by 20%.';
    return this.createExplosiveAmmo(ammo, this.statics.expBarbed, 'Barbed', desc);
  }

  createHeavyweightAmmo(ammo) {
    const desc =
      'Has a 50% increased chance to stagger, and a 25% chance to strike the target down.';
    return this.createExplosiveAmmo(ammo, this.statics.expHeavyweight, 'Heavyweight', desc);
  }

  createLightsourceAmmo(ammo) {
    const lightsourceAmmo = xelib.CopyElement(ammo, this.patchFile, true);
    this.names[lightsourceAmmo] = `${this.names[ammo]} - Lightsource`;
    xelib.AddElementValue(lightsourceAmmo, 'EDID', `REP_${this.names[ammo]} - Lightsource`);
    xelib.AddElementValue(lightsourceAmmo, 'FULL', this.names[lightsourceAmmo]);
    xelib.AddElementValue(lightsourceAmmo, 'DESC', 'Emits light after being fired.');
    this.patchStats(lightsourceAmmo);

    const projectile = xelib.GetWinningOverride(
      xelib.GetLinksTo(lightsourceAmmo, 'DATA\\Projectile')
    );
    xelib.SetValue(projectile, 'DATA\\Light', this.statics.lightLightsource);

    return lightsourceAmmo;
  }

  createNoisemakerAmmo(ammo) {
    const desc = 'Emits sound upon impact, distracting enemies.';
    return this.createExplosiveAmmo(ammo, this.statics.expNoisemaker, 'Noisemaker', desc);
  }

  createNeuralgiaAmmo(ammo) {
    const desc =
      'Doubles spell casting cost and drains 10 points of Magicka per second for 10 seconds.';
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

    const found = this.rules.baseStats.find(
      bs => this.names[ammo].includes(bs.identifier) && bs.type !== 'ARROW'
    );

    if (found) {
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
    xelib.SetUIntValue(baseItem, 'CNTO\\Count', ammoReforgeInputCount);

    secondaryIngredients.forEach(ingredient => {
      const secondaryItem = xelib.AddElement(newRecipe, 'Items\\.');
      xelib.SetValue(secondaryItem, 'CNTO\\Item', ingredient);
      xelib.SetUIntValue(secondaryItem, 'CNTO\\Count', secondaryIngredientInputCount);
    });

    xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
    xelib.AddElementValue(newRecipe, 'NAM1', `${ammoReforgeOutputCount}`);
    xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(newAmmo));

    xelib.AddElement(newRecipe, 'Conditions');

    requiredPerks.forEach((perk, index) => {
      let condition;

      if (index === 0) {
        condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      } else {
        condition = xelib.AddElement(newRecipe, 'Conditions\\.');
      }

      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    });

    createGetItemCountCondition(newRecipe, 11000000, ammoReforgeInputCount, baseAmmo);
  }
}

export const defaultSettings = {
  enabled: true
};
