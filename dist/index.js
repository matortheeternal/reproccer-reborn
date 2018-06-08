function _AwaitValue(value) {
  this.wrapped = value;
}

function _AsyncGenerator(gen) {
  var front, back;

  function send(key, arg) {
    return new Promise(function (resolve, reject) {
      var request = {
        key: key,
        arg: arg,
        resolve: resolve,
        reject: reject,
        next: null
      };

      if (back) {
        back = back.next = request;
      } else {
        front = back = request;
        resume(key, arg);
      }
    });
  }

  function resume(key, arg) {
    try {
      var result = gen[key](arg);
      var value = result.value;
      var wrappedAwait = value instanceof _AwaitValue;
      Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) {
        if (wrappedAwait) {
          resume("next", arg);
          return;
        }

        settle(result.done ? "return" : "normal", arg);
      }, function (err) {
        resume("throw", err);
      });
    } catch (err) {
      settle("throw", err);
    }
  }

  function settle(type, value) {
    switch (type) {
      case "return":
        front.resolve({
          value: value,
          done: true
        });
        break;

      case "throw":
        front.reject(value);
        break;

      default:
        front.resolve({
          value: value,
          done: false
        });
        break;
    }

    front = front.next;

    if (front) {
      resume(front.key, front.arg);
    } else {
      back = null;
    }
  }

  this._invoke = send;

  if (typeof gen.return !== "function") {
    this.return = undefined;
  }
}

if (typeof Symbol === "function" && Symbol.asyncIterator) {
  _AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
    return this;
  };
}

_AsyncGenerator.prototype.next = function (arg) {
  return this._invoke("next", arg);
};

_AsyncGenerator.prototype.throw = function (arg) {
  return this._invoke("throw", arg);
};

_AsyncGenerator.prototype.return = function (arg) {
  return this._invoke("return", arg);
};

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

var AlchemyPatcher =
/*#__PURE__*/
function () {
  function AlchemyPatcher() {
    _classCallCheck(this, AlchemyPatcher);

    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
    this.updateEffect = this.updateEffect.bind(this);
  } // eslint-disable-next-line no-unused-vars


  _createClass(AlchemyPatcher, [{
    key: "load",
    value: function load(plugin, helpers, settings, locals) {
      this.alchemy = locals.rules.alchemy;
      this.settings = settings;

      if (!settings.patchAlchemyIngredients) {
        return false;
      }

      return {
        signature: 'INGR'
      };
    } // eslint-disable-next-line no-unused-vars

  }, {
    key: "patch",
    value: function patch(ingredient, helpers, settings, locals) {
      this.updateEffects(ingredient);
      this.clampValue(ingredient);
    }
  }, {
    key: "updateEffects",
    value: function updateEffects(ingredient) {
      xelib.GetElements(ingredient, 'Effects').forEach(this.updateEffect);
    }
  }, {
    key: "updateEffect",
    value: function updateEffect(effect) {
      var _this = this;

      var mgef = xelib.GetWinningOverride(xelib.GetLinksTo(effect, 'EFID'));
      var name = xelib.FullName(mgef);

      if (this.alchemy.excludedEffects.includes(name)) {
        return;
      }

      var newDuration = xelib.GetIntValue(effect, 'EFIT\\Duration');
      var newMagnitude = xelib.GetFloatValue(effect, 'EFIT\\Magnitude');
      this.alchemy.baseStats.effects.some(function (e) {
        if (!name.includes(e.name)) {
          return false;
        }

        newDuration = _this.settings.alchemyBaseStats.durationBase + e.durationBonus;
        newMagnitude *= e.magnitudeFactor;
        return true;
      });

      if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Duration')) {
        xelib.SetUIntValue(effect, 'EFIT\\Duration', newDuration);
      }

      if (xelib.HasElement(mgef, 'Magic Effect Data') && !xelib.GetFlag(mgef, 'Magic Effect Data\\DATA\\Flags', 'No Magnitude')) {
        newMagnitude = Math.max(1.0, newMagnitude);
        xelib.SetFloatValue(effect, 'EFIT\\Magnitude', newMagnitude);
      }
    }
  }, {
    key: "clampValue",
    value: function clampValue(ingredient) {
      if (!this.settings.alchemyBaseStats.usePriceLimits) {
        return;
      }

      var min = this.settings.alchemyBaseStats.priceLimitLower;
      var max = this.settings.alchemyBaseStats.priceLimitUpper;
      var originalValue = xelib.GetValue(ingredient, 'DATA\\Value');
      var newValue = Math.min(Math.max(originalValue, min), max);
      xelib.SetFlag(ingredient, 'ENIT\\Flags', 'No auto-calculation', true);
      xelib.SetUIntValue(ingredient, 'DATA\\Value', newValue);
    }
  }]);

  return AlchemyPatcher;
}();

function overrideCraftingRecipes(cobj, armor, perk, patchFile) {
  var armorFormID = xelib.GetFormID(armor);
  cobj.forEach(function (recipe) {
    if (recipe.cnam !== armorFormID) {
      return;
    }

    var newRecipe = xelib.CopyElement(recipe.handle, patchFile);
    xelib.RemoveElement(newRecipe, 'Conditions');

    if (perk) {
      xelib.AddElement(newRecipe, 'Conditions');
      var condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(recipe.handle, condition, 10000000, 1, perk);
    }
  });
}
function createHasPerkCondition(recipe, type, value, perk) {
  var condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateHasPerkCondition(recipe, condition, type, value, perk);
  return condition;
}
function updateHasPerkCondition(recipe, condition, type, value, perk) {
  xelib.SetValue(condition, 'CTDA\\Type', "".concat(type));
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
  xelib.SetValue(condition, 'CTDA\\Perk', perk);
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}
function createGetItemCountCondition(recipe, type, value, object) {
  var condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateGetItemCountCondition(recipe, condition, type, value, object);
  return condition;
}
function updateGetItemCountCondition(recipe, condition, type, value, object) {
  xelib.SetValue(condition, 'CTDA\\Type', "".concat(type));
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'GetItemCount');
  xelib.SetValue(condition, 'CTDA\\Inventory Object', xelib.GetHexFormID(object));
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}

var includes = function includes(a, b) {
  return a.includes(b);
};

var equals = function equals(a, b) {
  return a === b;
};

var compare = function compare(a, b, inclusion) {
  return inclusion ? includes(a, b) : equals(a, b);
};

function getValueFromName(collection, name, field1, field2) {
  var inclusion = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
  var maxLength = 0;
  var value = null;
  collection.forEach(function (thing) {
    if (compare(name, thing[field1], inclusion) && thing[field1].length > maxLength) {
      value = thing[field2];
      maxLength = thing[field1].length;
    }
  });
  return value;
}
function getModifierFromMap(map, collection, handle, field1, field2) {
  var inclusion = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : true;
  var modifier = null;
  map.some(function (e) {
    if (!xelib.HasArrayItem(handle, 'KWDA', '', e.kwda)) {
      return false;
    }

    modifier = getValueFromName(collection, e.name, field1, field2, inclusion);
    return true;
  });
  return modifier;
}
function getKwda(handle) {
  return function (kwda) {
    return xelib.HasArrayItem(handle, 'KWDA', '', kwda);
  };
}
function addPerkScript(weapon, scriptName, propertyName, perk) {
  var vmad = xelib.AddElement(weapon, 'VMAD');
  xelib.SetIntValue(vmad, 'Version', 5);
  xelib.SetIntValue(vmad, 'Object Format', 2);
  var script = xelib.AddElement(vmad, 'Scripts\\.');
  xelib.SetValue(script, 'scriptName', scriptName);
  var property = xelib.AddElement(script, 'Properties\\.');
  xelib.SetValue(property, 'propertyName', propertyName);
  xelib.SetValue(property, 'Type', 'Object');
  xelib.SetValue(property, 'Flags', 'Edited');
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', perk);
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\Alias', 'None');
}

var ArmorPatcher =
/*#__PURE__*/
function () {
  function ArmorPatcher() {
    _classCallCheck(this, ArmorPatcher);

    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  } // eslint-disable-next-line no-unused-vars


  _createClass(ArmorPatcher, [{
    key: "load",
    value: function load(plugin, helpers, settings, locals) {
      var _this = this;

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
        filter: function filter(armor) {
          if (xelib.HasElement(armor, 'TNAM')) {
            return true;
          }

          if (!xelib.FullName(armor) || !xelib.HasElement(armor, 'KWDA')) {
            return false;
          }

          if (xelib.HasArrayItem(armor, 'KWDA', '', _this.statics.kwVendorItemClothing)) {
            return true;
          }

          if (xelib.HasArrayItem(armor, 'KWDA', '', _this.statics.kwJewelry)) {
            return false;
          }

          if (!(xelib.HasArrayItem(armor, 'KWDA', '', _this.statics.kwArmorHeavy) || xelib.HasArrayItem(armor, 'KWDA', '', _this.statics.kwArmorLight) || xelib.HasArrayItem(armor, 'KWDA', '', _this.statics.kwArmorSlotShield))) {
            return false;
          }

          return true;
        }
      };
    }
  }, {
    key: "updateGameSettings",
    value: function updateGameSettings() {
      var armorScalingFactorBaseRecord = xelib.GetRecord(0, parseInt(this.statics.gmstArmorScalingFactor, 16));
      var fArmorScalingFactor = xelib.CopyElement(armorScalingFactorBaseRecord, this.patchFile);
      xelib.SetFloatValue(fArmorScalingFactor, 'DATA\\Float', this.settings.armorBaseStats.protectionPerArmor);
      var maxArmorRatingBaseRecord = xelib.GetRecord(0, parseInt(this.statics.gmstMaxArmorRating, 16));
      var maxArmorRating = xelib.CopyElement(maxArmorRatingBaseRecord, this.patchFile);
      xelib.SetFloatValue(maxArmorRating, 'DATA\\Float', this.settings.armorBaseStats.maxProtection);
    } // eslint-disable-next-line no-unused-vars

  }, {
    key: "patch",
    value: function patch(armor, helpers, settings, locals) {
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
  }, {
    key: "patchShieldWeight",
    value: function patchShieldWeight(armor) {
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
  }, {
    key: "hasHeavyMaterialKeyword",
    value: function hasHeavyMaterialKeyword(armor) {
      var s = this.statics;
      var kwda = getKwda(armor);
      return kwda(s.kwArmorMaterialBlades) || kwda(s.kwArmorMaterialDraugr) || kwda(s.kwArmorMaterialIron) || kwda(s.kwArmorMaterialDwarven) || kwda(s.kwArmorMaterialOrcish) || kwda(s.kwArmorMaterialFalmer) || kwda(s.kwArmorMaterialFalmerHeavyOriginal) || kwda(s.kwArmorMaterialDaedric) || kwda(s.kwArmorMaterialEbony) || kwda(s.kwArmorMaterialDawnguard) || kwda(s.kwArmorMaterialImperialHeavy) || kwda(s.kwArmorMaterialSteel) || kwda(s.kwArmorMaterialIronBanded) || kwda(s.kwArmorMaterialDragonplate) || kwda(s.kwArmorMaterialSteelPlate);
    }
  }, {
    key: "patchMasqueradeKeywords",
    value: function patchMasqueradeKeywords(armor) {
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
  }, {
    key: "processClothing",
    value: function processClothing(armor) {
      var _this2 = this;

      this.addClothingMeltdownRecipe(armor);

      if (this.armor.excludedDreamcloth.find(function (ed) {
        return _this2.names[armor].includes(ed);
      })) {
        return;
      }

      if (xelib.HasElement(armor, 'EITM')) {
        return;
      }

      var dreamcloth = this.createDreamcloth(armor);

      if (!dreamcloth) {
        return;
      }

      this.addClothingCraftingRecipe(dreamcloth, true);
      this.addClothingMeltdownRecipe(dreamcloth, true);
    }
  }, {
    key: "createDreamcloth",
    value: function createDreamcloth(armor) {
      var s = this.statics;
      var kwda = getKwda(armor);
      var dreamclothPerk;

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

      var newName = "".concat(this.names[armor], " [Dreamcloth]");
      var newDreamcloth = xelib.CopyElement(armor, this.patchFile, true);
      xelib.AddElementValue(newDreamcloth, 'EDID', "REP_DREAMCLOTH_".concat(newName));
      xelib.AddElementValue(newDreamcloth, 'FULL', newName);
      this.names[newDreamcloth] = newName;
      xelib.RemoveElement(newDreamcloth, 'EITM');
      xelib.RemoveElement(newDreamcloth, 'DESC');
      xelib.AddElementValue(newDreamcloth, 'KWDA\\.', s.kwArmorDreamcloth);
      addPerkScript(newDreamcloth, 'xxxDreamCloth', 'p', dreamclothPerk);
      return newDreamcloth;
    }
  }, {
    key: "addClothingMeltdownRecipe",
    value: function addClothingMeltdownRecipe(armor, isDreamCloth) {
      var s = this.statics;
      var kwda = getKwda(armor);
      var returnQuantity = 1;
      var inputQuantity = 1;

      if (kwda(s.kwClothingBody)) {
        returnQuantity += 2;
      } else if (kwda(s.kwClothingHands) || kwda(s.kwClothingHead) || kwda(s.kwClothingFeet)) {
        returnQuantity += 1;
      }

      var newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(newRecipe, 'EDID', "REP_MELTDOWN_CLOTHING_".concat(this.names[armor]));
      xelib.AddElement(newRecipe, 'Items');
      var ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
      xelib.SetValue(ingredient, 'CNTO\\Item', xelib.GetHexFormID(armor));
      xelib.SetUIntValue(ingredient, 'CNTO\\Count', inputQuantity);
      xelib.AddElementValue(newRecipe, 'NAM1', "".concat(returnQuantity));
      xelib.AddElementValue(newRecipe, 'CNAM', s.leatherStrips);
      xelib.AddElementValue(newRecipe, 'BNAM', s.kwCraftingTanningRack);
      xelib.AddElement(newRecipe, 'Conditions');
      var condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

      if (isDreamCloth) {
        createHasPerkCondition(newRecipe, 10000000, 1, s.perkSmithingWeavingMill);
      }

      createGetItemCountCondition(newRecipe, 11000000, 1, armor);
    }
  }, {
    key: "addClothingCraftingRecipe",
    value: function addClothingCraftingRecipe(armor, isDreamCloth) {
      var s = this.statics;
      var kwda = getKwda(armor);
      var newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(newRecipe, 'EDID', "REP_CRAFT_CLOTHING_".concat(this.names[armor]));
      var quantityIngredient1 = 2;

      if (kwda(s.kwClothingBody)) {
        quantityIngredient1 += 2;
      } else if (kwda(s.kwClothingHead)) {
        quantityIngredient1 += 1;
      }

      xelib.AddElement(newRecipe, 'Items');
      var ingredient = xelib.AddElement(newRecipe, 'Items\\[0]');
      xelib.SetValue(ingredient, 'CNTO\\Item', s.leather);
      xelib.SetUIntValue(ingredient, 'CNTO\\Count', quantityIngredient1);
      xelib.AddElementValue(newRecipe, 'NAM1', '1');
      xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(armor));
      xelib.AddElementValue(newRecipe, 'BNAM', s.kwCraftingTanningRack);
      var secondaryIngredients = [];
      secondaryIngredients.push(s.leatherStrips);

      if (isDreamCloth) {
        secondaryIngredients.push(s.pettySoulGem);
        xelib.AddElement(newRecipe, 'Conditions');
        var condition = xelib.AddElement(newRecipe, 'Conditions\\[0]');
        updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingWeavingMill);
      }

      secondaryIngredients.forEach(function (hexcode) {
        var ingr = xelib.AddElement(newRecipe, 'Items\\.');
        xelib.SetValue(ingr, 'CNTO\\Item', hexcode);
        xelib.SetUIntValue(ingr, 'CNTO\\Count', 1);
      });
    }
  }, {
    key: "overrideMaterialKeywords",
    value: function overrideMaterialKeywords(armor) {
      var override = this.getArmorMaterialOverride(this.names[armor]);

      if (!override || this.hasMaterialKeyword(armor)) {
        return;
      } // prettier-ignore


      var overrideMap = {
        BONEMOLD_HEAVY: {
          kwda: this.statics.kwArmorMaterialNordicLight,
          perk: this.statics.perkSmithingAdvanced
        },
        DAEDRIC: {
          kwda: this.statics.kwArmorMaterialDaedric,
          perk: this.statics.perkSmithingDaedric
        },
        DRAGONPLATE: {
          kwda: this.statics.kwArmorMaterialDragonPlate,
          perk: this.statics.perkSmithingDragon
        },
        DRAGONSCALE: {
          kwda: this.statics.kwArmorMaterialDragonscale,
          perk: this.statics.perkSmithingDragon
        },
        DWARVEN: {
          kwda: this.statics.kwArmorMaterialDwarven,
          perk: this.statics.perkSmithingDwarven
        },
        EBONY: {
          kwda: this.statics.kwArmorMaterialEbony,
          perk: this.statics.perkSmithingEbony
        },
        ELVEN: {
          kwda: this.statics.kwArmorMaterialElven,
          perk: this.statics.perkSmithingElven
        },
        FALMER: {
          kwda: this.statics.kwArmorMaterialFalmer,
          perk: this.statics.perkSmithingAdvanced
        },
        FUR: {
          kwda: this.statics.kwArmorMaterialFur,
          perk: null
        },
        GLASS: {
          kwda: this.statics.kwArmorMaterialGlass,
          perk: this.statics.perkSmithingGlass
        },
        HIDE: {
          kwda: this.statics.kwArmorMaterialHide,
          perk: null
        },
        IRON: {
          kwda: this.statics.kwArmorMaterialIron,
          perk: null
        },
        LEATHER: {
          kwda: this.statics.kwArmorMaterialLeather,
          perk: this.statics.perkSmithingLeather
        },
        NORDIC_HEAVY: {
          kwda: this.statics.kwArmorMaterialNordicHeavy,
          perk: this.statics.perkSmithingAdvanced
        },
        ORCISH: {
          kwda: this.statics.kwArmorMaterialOrcish,
          perk: this.statics.perkSmithingOrcish
        },
        SCALED: {
          kwda: this.statics.kwArmorMaterialScaled,
          perk: this.statics.perkSmithingAdvanced
        },
        STALHRIM_HEAVY: {
          kwda: this.statics.kwArmorMaterialStalhrimHeavy,
          perk: this.statics.perkSmithingAdvanced
        },
        STALHRIM_LIGHT: {
          kwda: this.statics.kwArmorMaterialStalhrimLight,
          perk: this.statics.perkSmithingAdvanced
        },
        STEEL: {
          kwda: this.statics.kwArmorMaterialSteel,
          perk: this.statics.perkSmithingSteel
        },
        STEELPLATE: {
          kwda: this.statics.kwArmorMaterialSteelPlate,
          perk: this.statics.perkSmithingAdvanced
        }
      };

      if (overrideMap[override]) {
        xelib.AddElementValue(armor, 'KWDA\\.', overrideMap[override].kwda);
        overrideCraftingRecipes(this.cobj, armor, overrideMap[override].perk, this.patchFile);
      }
    }
  }, {
    key: "getArmorMaterialOverride",
    value: function getArmorMaterialOverride(name) {
      var override = this.armor.materialOverrides.find(function (o) {
        return name.includes(o.substring);
      });
      return override ? override.material : null;
    }
  }, {
    key: "hasMaterialKeyword",
    value: function hasMaterialKeyword(armor) {
      var s = this.statics;
      var kwda = getKwda(armor);
      return kwda(s.kwArmorMaterialDaedric) || kwda(s.kwArmorMaterialSteel) || kwda(s.kwArmorMaterialIron) || kwda(s.kwArmorMaterialDwarven) || kwda(s.kwArmorMaterialFalmer) || kwda(s.kwArmorMaterialOrcish) || kwda(s.kwArmorMaterialEbony) || kwda(s.kwArmorMaterialSteelPlate) || kwda(s.kwArmorMaterialDragonplate) || kwda(s.kwArmorMaterialFur) || kwda(s.kwArmorMaterialHide) || kwda(s.kwArmorMaterialLeather) || kwda(s.kwArmorMaterialElven) || kwda(s.kwArmorMaterialScaled) || kwda(s.kwArmorMaterialGlass) || kwda(s.kwArmorMaterialDragonscale) || kwda(s.kwArmorMaterialNordicHeavy) || kwda(s.kwArmorMaterialStalhrimHeavy) || kwda(s.kwArmorMaterialStalhrimLight) || kwda(s.kwArmorMaterialBonemoldHeavy);
    }
  }, {
    key: "patchArmorRating",
    value: function patchArmorRating(armor) {
      var rating = Math.floor(this.getArmorSlotMultiplier(armor) * this.getMaterialArmorModifier(armor));
      xelib.SetValue(armor, 'DNAM', "".concat(rating));
    }
  }, {
    key: "getArmorSlotMultiplier",
    value: function getArmorSlotMultiplier(armor) {
      var kwda = getKwda(armor);

      if (kwda(this.statics.kwArmorSlotBoots)) {
        return this.settings.armorBaseStats.armorFactorBoots;
      }

      if (kwda(this.statics.kwArmorSlotCuirass)) {
        return this.settings.armorBaseStats.armorFactorCuirass;
      }

      if (kwda(this.statics.kwArmorSlotGauntlets)) {
        return this.settings.armorBaseStats.armorFactorGauntlets;
      }

      if (kwda(this.statics.kwArmorSlotHelmet)) {
        return this.settings.armorBaseStats.armorFactorHelmet;
      }

      if (kwda(this.statics.kwArmorSlotShield)) {
        return this.settings.armorBaseStats.armorFactorShield;
      }

      return 0;
    }
  }, {
    key: "getMaterialArmorModifier",
    value: function getMaterialArmorModifier(armor) {
      var _this3 = this;

      var armorRating = getValueFromName(this.armor.materials, this.names[armor], 'name', 'armor');

      if (armorRating !== null) {
        return armorRating;
      }

      var s = this.statics; // prettier-ignore

      var keywordMaterialMap = [{
        kwda: s.kwArmorMaterialBlades,
        name: 'Blades'
      }, {
        kwda: s.kwArmorMaterialBonemoldHeavy,
        name: 'Bonemold'
      }, {
        kwda: s.kwArmorMaterialDarkBrotherhood,
        name: 'Shrouded'
      }, {
        kwda: s.kwArmorMaterialDaedric,
        name: 'Daedric'
      }, {
        kwda: s.kwArmorMaterialDawnguard,
        name: 'Dawnguard Light'
      }, {
        kwda: s.kwArmorMaterialDragonplate,
        name: 'Dragonplate'
      }, {
        kwda: s.kwArmorMaterialDragonscale,
        name: 'Dragonscale'
      }, {
        kwda: s.kwArmorMaterialDraugr,
        name: 'Ancient Nord'
      }, {
        kwda: s.kwArmorMaterialDwarven,
        name: 'Dwarven'
      }, {
        kwda: s.kwArmorMaterialEbony,
        name: 'Ebony'
      }, {
        kwda: s.kwArmorMaterialElven,
        name: 'Elven'
      }, {
        kwda: s.kwArmorMaterialElvenGilded,
        name: 'Elven Gilded'
      }, {
        kwda: s.kwArmorMaterialFalmer,
        name: 'Falmer'
      }, {
        kwda: s.kwArmorMaterialFalmerHardened,
        name: 'Falmer Hardened'
      }, {
        kwda: s.kwArmorMaterialFalmerHeavy,
        name: 'Falmer Heavy'
      }, {
        kwda: s.kwArmorMaterialFur,
        name: 'Fur'
      }, {
        kwda: s.kwArmorMaterialGlass,
        name: 'Glass'
      }, {
        kwda: s.kwArmorMaterialHide,
        name: 'Hide'
      }, {
        kwda: s.kwArmorMaterialHunter,
        name: 'Dawnguard Heavy'
      }, {
        kwda: s.kwArmorMaterialImperialHeavy,
        name: 'Imperial Heavy'
      }, {
        kwda: s.kwArmorMaterialImperialLight,
        name: 'Imperial Light'
      }, {
        kwda: s.kwArmorMaterialImperialStudded,
        name: 'Studded Imperial'
      }, {
        kwda: s.kwArmorMaterialIron,
        name: 'Iron'
      }, {
        kwda: s.kwArmorMaterialIronBanded,
        name: 'Iron Banded'
      }, {
        kwda: s.kwArmorMaterialLeather,
        name: 'Leather'
      }, {
        kwda: s.kwArmorMaterialNightingale,
        name: 'Nightingale'
      }, {
        kwda: s.kwArmorMaterialNordicHeavy,
        name: 'Nordic'
      }, {
        kwda: s.kwArmorMaterialOrcish,
        name: 'Orcish'
      }, {
        kwda: s.kwArmorMaterialScaled,
        name: 'Scaled'
      }, {
        kwda: s.kwArmorMaterialStalhrimHeavy,
        name: 'Stalhrim Heavy'
      }, {
        kwda: s.kwArmorMaterialStalhrimLight,
        name: 'Stalhrim Light'
      }, {
        kwda: s.kwArmorMaterialSteel,
        name: 'Steel'
      }, {
        kwda: s.kwArmorMaterialSteelPlate,
        name: 'Steel Plate'
      }, {
        kwda: s.kwArmorMaterialStormcloak,
        name: 'Stormcloak'
      }, {
        kwda: s.kwArmorMaterialStudded,
        name: 'Studded'
      }, {
        kwda: s.kwArmorMaterialVampire,
        name: 'Vampire'
      }];
      keywordMaterialMap.some(function (pair) {
        if (!xelib.HasArrayItem(armor, 'KWDA', '', pair.kwda)) {
          return false;
        }

        armorRating = getValueFromName(_this3.armor.materials, pair.name, 'name', 'armor');
        return true;
      });

      if (armorRating !== null) {
        return armorRating;
      }

      return 0;
    }
  }, {
    key: "modifyRecipes",
    value: function modifyRecipes(armor) {
      var _this4 = this;

      var armorFormID = xelib.GetFormID(armor);
      var armorHasLeatherKwda = xelib.HasArrayItem(armor, 'KWDA', '', this.statics.kwArmorMaterialLeather);
      this.cobj.forEach(function (recipe) {
        _this4.modifyTemperingRecipe(armor, armorFormID, recipe);

        _this4.modifyLeatherCraftingRecipe(armor, armorFormID, armorHasLeatherKwda, recipe);
      });
    }
  }, {
    key: "modifyTemperingRecipe",
    value: function modifyTemperingRecipe(armor, armorFormID, recipe) {
      var bnam = recipe.bnam,
          cnam = recipe.cnam;
      var bench = parseInt(this.statics.kwCraftingSmithingArmorTable, 16);

      if (bnam !== bench || cnam !== armorFormID) {
        return;
      }

      var perk = this.temperingPerkFromKeyword(armor);

      if (!perk) {
        return;
      }

      var newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
      var condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    }
  }, {
    key: "temperingPerkFromKeyword",
    value: function temperingPerkFromKeyword(armor) {
      var s = this.statics;
      var kwda = getKwda(armor);
      var perk;

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
      } else if (kwda(s.kwArmorMaterialFalmer) || kwda(s.kwArmorMaterialFalmerHardened) || kwda(s.kwArmorMaterialFalmerHeavy) || kwda(s.kwArmorMaterialFalmerHeavyOriginal)) {
        perk = s.perkSmithingAdvanced;
      } else if (kwda(s.kwArmorMaterialGlass)) {
        perk = s.perkSmithingGlass;
      } else if (kwda(s.kwArmorMaterialImperialLight) || kwda(s.kwArmorMaterialImperialStudded) || kwda(s.kwArmorMaterialDawnguard) || kwda(s.kwArmorMaterialHunter)) {
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
          if (kwda(s.kwArmorMaterialSteelPlate) || kwda(s.kwArmorMaterialScaled) || kwda(s.kwArmorMaterialStalhrimLight) || kwda(s.kwArmorMaterialStalhrimHeavy) || kwda(s.kwArmorMaterialBonemoldHeavy) || kwda(s.kwArmorMaterialNordicHeavy)) {
            perk = s.perkSmithingAdvanced;
          }
        }
      }

      return perk;
    }
  }, {
    key: "modifyLeatherCraftingRecipe",
    value: function modifyLeatherCraftingRecipe(armor, armorFormID, armorHasLeatherKwda, recipe) {
      if (!armorHasLeatherKwda || recipe.cnam !== armorFormID) {
        return;
      }

      var newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
      createHasPerkCondition(newRecipe, 10000000, 1, this.statics.perkSmithingLeather);
    }
  }, {
    key: "addMeltdownRecipe",
    value: function addMeltdownRecipe(armor) {
      var s = this.statics;
      var kwda = getKwda(armor);

      var incr = function incr(v) {
        return v + 1;
      };

      var noop = function noop(v) {
        return v;
      }; // prettier-ignore


      var keywordMap = [{
        kwda: s.kwArmorMaterialBlades,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialBonemoldHeavy,
        cnam: s.netchLeather,
        perk: s.perkSmithingAdvanced,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialDaedric,
        cnam: s.ingotEbony,
        perk: s.perkSmithingDaedric,
        bnam: s.kwCraftingSmelter,
        func: incr
      }, {
        kwda: s.kwArmorMaterialDarkBrotherhood,
        cnam: s.leatherStrips,
        perk: s.perkSmithingLeather,
        bnam: s.kwCraftingTanningRack,
        func: incr
      }, {
        kwda: s.kwArmorMaterialDawnguard,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialDragonplate,
        cnam: s.dragonbone,
        perk: s.perkSmithingDragon,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialDragonscale,
        cnam: s.dragonscale,
        perk: s.perkSmithingDragon,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialDwarven,
        cnam: s.ingotDwarven,
        perk: s.perkSmithingDwarven,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialEbony,
        cnam: s.ingotEbony,
        perk: s.perkSmithingEbony,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialElven,
        cnam: s.ingotMoonstone,
        perk: s.perkSmithingElven,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialElvenGilded,
        cnam: s.ingotMoonstone,
        perk: s.perkSmithingElven,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialFalmer,
        cnam: s.chaurusChitin,
        perk: null,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialFalmerHardened,
        cnam: s.chaurusChitin,
        perk: null,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialFalmerHeavy,
        cnam: s.chaurusChitin,
        perk: null,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialFur,
        cnam: s.leatherStrips,
        perk: null,
        bnam: s.kwCraftingTanningRack,
        func: noop
      }, {
        kwda: s.kwArmorMaterialHide,
        cnam: s.leatherStrips,
        perk: null,
        bnam: s.kwCraftingTanningRack,
        func: noop
      }, {
        kwda: s.kwArmorMaterialGlass,
        cnam: s.ingotMalachite,
        perk: s.perkSmithingGlass,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialHunter,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialImperialHeavy,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialImperialLight,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialImperialStudded,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialIron,
        cnam: s.ingotIron,
        perk: null,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialLeather,
        cnam: s.leatherStrips,
        perk: s.perkSmithingLeather,
        bnam: s.kwCraftingTanningRack,
        func: incr
      }, {
        kwda: s.kwArmorMaterialNightingale,
        cnam: s.leatherStrips,
        perk: s.perkSmithingLeather,
        bnam: s.kwCraftingTanningRack,
        func: incr
      }, {
        kwda: s.kwArmorMaterialNordicHeavy,
        cnam: s.ingotQuicksilver,
        perk: s.perkSmithingAdvanced,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialOrcish,
        cnam: s.ingotOrichalcum,
        perk: s.perkSmithingOrcish,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialScaled,
        cnam: s.ingotCorundum,
        perk: s.perkSmithingAdvanced,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialStalhrimHeavy,
        cnam: s.oreStalhrim,
        perk: s.perkSmithingAdvanced,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialStalhrimLight,
        cnam: s.oreStalhrim,
        perk: s.perkSmithingAdvanced,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialSteel,
        cnam: s.ingotSteel,
        perk: s.perkSmithingSteel,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialSteelPlate,
        cnam: s.ingotCorundum,
        perk: s.perkSmithingAdvanced,
        bnam: s.kwCraftingSmelter,
        func: noop
      }, {
        kwda: s.kwArmorMaterialStormcloak,
        cnam: s.ingotIron,
        perk: null,
        bnam: s.kwCraftingSmelter,
        func: noop
      }];
      var outputQuantity = 1;
      var inputQuantity = 1;
      var cnam;
      var perk;
      var bnam;

      if (kwda(s.kwArmorSlotCuirass) || kwda(s.kwArmorSlotShield)) {
        outputQuantity += 1;
      }

      if (kwda(s.kwArmorMaterialDraugr)) {
        cnam = s.dragonScale;
        bnam = s.kwCraftingSmelter;
        perk = s.perkSmithingSteel;
        inputQuantity += 1;
      } else {
        keywordMap.some(function (e) {
          if (!kwda(e.kwda)) {
            return false;
          }

          bnam = e.bnam;
          cnam = e.cnam;
          perk = e.perk;
          outputQuantity = e.func(outputQuantity);
          return true;
        });
      }

      if (!cnam) {
        return;
      }

      var recipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(recipe, 'EDID', "REP_MELTDOWN_".concat(this.names[armor]));
      xelib.AddElementValue(recipe, 'BNAM', bnam);
      xelib.AddElementValue(recipe, 'CNAM', cnam);
      xelib.AddElementValue(recipe, 'NAM1', "".concat(outputQuantity));
      xelib.AddElement(recipe, 'Items');
      var baseItem = xelib.GetElement(recipe, 'Items\\[0]');
      xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(armor));
      xelib.SetUIntValue(baseItem, 'CNTO\\Count', inputQuantity);
      xelib.AddElement(recipe, 'Conditions');
      var condition = xelib.GetElement(recipe, 'Conditions\\[0]');
      updateHasPerkCondition(recipe, condition, 10000000, 1, this.statics.perkSmithingMeltdown);

      if (perk) {
        createHasPerkCondition(recipe, 10000000, 1, perk);
      }

      createGetItemCountCondition(recipe, 11000000, 1.0, armor);
    }
  }]);

  return ArmorPatcher;
}();

var ProjectilePatcher =
/*#__PURE__*/
function () {
  function ProjectilePatcher() {
    _classCallCheck(this, ProjectilePatcher);

    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
  }

  _createClass(ProjectilePatcher, [{
    key: "load",
    value: function load(plugin, helpers, settings, locals) {
      var _this = this;

      if (!settings.patchProjectiles) {
        return false;
      }

      this.patchFile = locals.patch;
      this.projectiles = locals.rules.projectiles;
      this.statics = locals.statics;
      this.names = {};
      return {
        signature: 'AMMO',
        filter: function filter(record) {
          var ammo = xelib.GetWinningOverride(record);
          var name = xelib.FullName(ammo);

          if (!name) {
            return false;
          }

          if (_this.projectiles.excludedAmmunition.find(function (ex) {
            return name.includes(ex);
          })) {
            return false;
          }

          if (!_this.projectiles.baseStats.find(function (bs) {
            return name.includes(bs.identifier);
          })) {
            return false;
          }

          return true;
        }
      };
    } // eslint-disable-next-line no-unused-vars

  }, {
    key: "patch",
    value: function patch(ammo, helpers, settings, locals) {
      this.names[ammo] = xelib.FullName(ammo);
      this.patchStats(ammo);
      this.addVariants(ammo);
    }
  }, {
    key: "patchStats",
    value: function patchStats(ammo) {
      var _this$calculateProjec = this.calculateProjectileStats(this.names[ammo]),
          newGravity = _this$calculateProjec.newGravity,
          newSpeed = _this$calculateProjec.newSpeed,
          newRange = _this$calculateProjec.newRange,
          newDamage = _this$calculateProjec.newDamage,
          failed = _this$calculateProjec.failed;

      if (failed) {
        return;
      }

      var oldProjectile = xelib.GetWinningOverride(xelib.GetLinksTo(ammo, 'DATA\\Projectile'));
      var newProjectile = xelib.CopyElement(oldProjectile, this.patchFile, true);
      xelib.AddElementValue(newProjectile, 'EDID', "REP_PROJ_".concat(this.names[ammo]));
      xelib.SetFloatValue(newProjectile, 'DATA\\Gravity', newGravity);
      xelib.SetFloatValue(newProjectile, 'DATA\\Speed', newSpeed);
      xelib.SetFloatValue(newProjectile, 'DATA\\Range', newRange);
      xelib.SetValue(ammo, 'DATA\\Projectile', xelib.GetHexFormID(newProjectile));
      xelib.SetUIntValue(ammo, 'DATA\\Damage', newDamage);
    }
  }, {
    key: "calculateProjectileStats",
    value: function calculateProjectileStats(name) {
      var newGravity = 0;
      var newSpeed = 0;
      var newRange = 0;
      var newDamage = 0;
      var failed = false;
      this.projectiles.baseStats.some(function (bs) {
        if (!name.includes(bs.identifier)) {
          return false;
        }

        newGravity = bs.gravity;
        newSpeed = bs.speed;
        newRange = bs.range;
        newDamage = bs.damage;
        return true;
      });
      this.projectiles.materialStats.some(function (ms) {
        if (!name.includes(ms.name)) {
          return false;
        }

        newGravity += ms.gravity;
        newSpeed += ms.speed;
        newDamage += ms.damage;
        return true;
      });
      this.projectiles.modifierStats.some(function (ms) {
        if (!name.includes(ms.name)) {
          return false;
        }

        newGravity += ms.gravity;
        newSpeed += ms.speed;
        newDamage += ms.damage;
        return true;
      });
      failed = newGravity <= 0 || newSpeed <= 0 || newRange <= 0 || newDamage <= 0;
      return {
        newGravity: newGravity,
        newSpeed: newSpeed,
        newRange: newRange,
        newDamage: newDamage,
        failed: failed
      };
    }
  }, {
    key: "addVariants",
    value: function addVariants(ammo) {
      var _this2 = this;

      if (this.projectiles.excludedAmmunitionVariants.find(function (v) {
        return _this2.names[ammo].includes(v);
      })) {
        return;
      }

      this.createVariants(ammo);
      this.multiplyBolts(ammo);
    }
  }, {
    key: "multiplyBolts",
    value: function multiplyBolts(ammo) {
      var _this3 = this;

      var found = this.projectiles.baseStats.find(function (bs) {
        return _this3.names[ammo].includes(bs.identifier) && bs.type !== 'BOLT';
      });

      if (found) {
        return;
      }

      var s = this.statics;
      var secondaryIngredients = [];
      var requiredPerks = [];
      var strongAmmo = this.createStrongAmmo(ammo);
      secondaryIngredients = [s.ingotIron];
      requiredPerks = [s.perkMarksmanshipAdvancedMissilecraft0];
      this.addCraftingRecipe(ammo, strongAmmo, secondaryIngredients, requiredPerks);
      this.createVariants(strongAmmo);
      var strongestAmmo = this.createStrongestAmmo(ammo);
      secondaryIngredients = [s.ingotSteel, s.ingotIron];
      requiredPerks = [s.perkMarksmanshipAdvancedMissilecraft0];
      this.addCraftingRecipe(ammo, strongestAmmo, secondaryIngredients, requiredPerks);
      this.createVariants(strongestAmmo);
    }
  }, {
    key: "createStrongAmmo",
    value: function createStrongAmmo(ammo) {
      var strongAmmo = xelib.CopyElement(ammo, this.patchFile, true);
      this.names[strongAmmo] = "".concat(this.names[ammo], " - Strong");
      xelib.AddElementValue(strongAmmo, 'EDID', "REP_".concat(this.names[ammo], " - Strong"));
      xelib.AddElementValue(strongAmmo, 'FULL', this.names[strongAmmo]);
      this.patchStats(strongAmmo);
      return strongAmmo;
    }
  }, {
    key: "createStrongestAmmo",
    value: function createStrongestAmmo(ammo) {
      var strongestAmmo = xelib.CopyElement(ammo, this.patchFile, true);
      this.names[strongestAmmo] = "".concat(this.names[ammo], " - Strongest");
      xelib.AddElementValue(strongestAmmo, 'EDID', "REP_".concat(this.names[ammo], " - Strongest"));
      xelib.AddElementValue(strongestAmmo, 'FULL', this.names[strongestAmmo]);
      this.patchStats(strongestAmmo);
      return strongestAmmo;
    }
  }, {
    key: "createExplodingAmmo",
    value: function createExplodingAmmo(ammo) {
      var desc = 'Explodes upon impact, dealing 60 points of non-elemental damage.';
      return this.createExplosiveAmmo(ammo, this.statics.expExploding, 'Explosive', desc);
    }
  }, {
    key: "createTimebombAmmo",
    value: function createTimebombAmmo(ammo) {
      var timer = 3;
      var timebombAmmo = xelib.CopyElement(ammo, this.patchFile, true);
      this.names[timebombAmmo] = "".concat(this.names[ammo], " - Timebomb");
      xelib.AddElementValue(timebombAmmo, 'EDID', "REP_".concat(this.names[ammo], " - Timebomb"));
      xelib.AddElementValue(timebombAmmo, 'FULL', this.names[timebombAmmo]);
      xelib.AddElementValue(timebombAmmo, 'DESC', 'Explodes 3 seconds after being fired into a surface, dealing 150 points of non-elemental damage.');
      this.patchStats(timebombAmmo);
      var projectile = xelib.GetWinningOverride(xelib.GetLinksTo(timebombAmmo, 'DATA\\Projectile'));
      xelib.SetFlag(projectile, 'DATA\\Flags', 'Explosion', true);
      xelib.SetFlag(projectile, 'DATA\\Flags', 'Alt. Trigger', true);
      xelib.SetFloatValue(projectile, 'DATA\\Explosion - Alt. Trigger - Timer', timer);
      xelib.SetValue(projectile, 'DATA\\Explosion', this.statics.expTimebomb);
      return timebombAmmo;
    }
  }, {
    key: "createFrostAmmo",
    value: function createFrostAmmo(ammo) {
      var desc = 'Explodes upon impact, dealing 30 points of frost damage.';
      return this.createExplosiveAmmo(ammo, this.statics.expElementalFrost, 'Frost', desc);
    }
  }, {
    key: "createFireAmmo",
    value: function createFireAmmo(ammo) {
      var desc = 'Explodes upon impact, dealing 30 points of fire damage.';
      return this.createExplosiveAmmo(ammo, this.statics.expElementalFire, 'Fire', desc);
    }
  }, {
    key: "createShockAmmo",
    value: function createShockAmmo(ammo) {
      var desc = 'Explodes upon impact, dealing 30 points of shock damage.';
      return this.createExplosiveAmmo(ammo, this.statics.expElementalShock, 'Shock', desc);
    }
  }, {
    key: "createBarbedAmmo",
    value: function createBarbedAmmo(ammo) {
      var desc = 'Deals 6 points of bleeding damag per second over 8 seconds, and slows the target down by 20%.';
      return this.createExplosiveAmmo(ammo, this.statics.expBarbed, 'Barbed', desc);
    }
  }, {
    key: "createHeavyweightAmmo",
    value: function createHeavyweightAmmo(ammo) {
      var desc = 'Has a 50% increased chance to stagger, and a 25% chance to strike the target down.';
      return this.createExplosiveAmmo(ammo, this.statics.expHeavyweight, 'Heavyweight', desc);
    }
  }, {
    key: "createLightsourceAmmo",
    value: function createLightsourceAmmo(ammo) {
      var lightsourceAmmo = xelib.CopyElement(ammo, this.patchFile, true);
      this.names[lightsourceAmmo] = "".concat(this.names[ammo], " - Lightsource");
      xelib.AddElementValue(lightsourceAmmo, 'EDID', "REP_".concat(this.names[ammo], " - Lightsource"));
      xelib.AddElementValue(lightsourceAmmo, 'FULL', this.names[lightsourceAmmo]);
      xelib.AddElementValue(lightsourceAmmo, 'DESC', 'Emits light after being fired.');
      this.patchStats(lightsourceAmmo);
      var projectile = xelib.GetWinningOverride(xelib.GetLinksTo(lightsourceAmmo, 'DATA\\Projectile'));
      xelib.SetValue(projectile, 'DATA\\Light', this.statics.lightLightsource);
      return lightsourceAmmo;
    }
  }, {
    key: "createNoisemakerAmmo",
    value: function createNoisemakerAmmo(ammo) {
      var desc = 'Emits sound upon impact, distracting enemies.';
      return this.createExplosiveAmmo(ammo, this.statics.expNoisemaker, 'Noisemaker', desc);
    }
  }, {
    key: "createNeuralgiaAmmo",
    value: function createNeuralgiaAmmo(ammo) {
      var desc = 'Doubles spell casting cost and drains 10 points of Magicka per second for 10 seconds.';
      return this.createExplosiveAmmo(ammo, this.statics.expNeuralgia, 'Neuralgia', desc);
    }
  }, {
    key: "createExplosiveAmmo",
    value: function createExplosiveAmmo(ammo, explosion, type, desc) {
      var newAmmo = xelib.CopyElement(ammo, this.patchFile, true);
      this.names[newAmmo] = "".concat(this.names[ammo], " - ").concat(type);
      xelib.AddElementValue(newAmmo, 'EDID', "REP_".concat(this.names[ammo], " - ").concat(type));
      xelib.AddElementValue(newAmmo, 'FULL', this.names[newAmmo]);
      xelib.AddElementValue(newAmmo, 'DESC', desc);
      this.patchStats(newAmmo);
      var projectile = xelib.GetLinksTo(newAmmo, 'DATA\\Projectile');
      xelib.SetFlag(projectile, 'DATA\\Flags', 'Explosion', true);
      xelib.SetFlag(projectile, 'DATA\\Flags', 'Alt. Trigger', false);
      xelib.SetValue(projectile, 'DATA\\Explosion', explosion);
      return newAmmo;
    }
  }, {
    key: "createVariants",
    value: function createVariants(ammo) {
      var _this4 = this;

      var s = this.statics;
      var ingredients = [];
      var perks = [];
      var explodingAmmo = this.createExplodingAmmo(ammo);
      ingredients = [s.ale, s.torchbugThorax];
      perks = [s.perkAlchemyFuse];
      this.addCraftingRecipe(ammo, explodingAmmo, ingredients, perks);
      var timebombAmmo = this.createTimebombAmmo(ammo);
      ingredients = [s.fireSalt, s.torchbugThorax];
      perks = [s.perkAlchemyAdvancedExplosives];
      this.addCraftingRecipe(ammo, timebombAmmo, ingredients, perks);
      var lightsourceAmmo = this.createLightsourceAmmo(ammo);
      ingredients = [s.torchbugThorax, s.leatherStrips];
      perks = [s.perkSneakThiefsToolbox0];
      this.addCraftingRecipe(ammo, lightsourceAmmo, ingredients, perks);
      var noisemakerAmmo = this.createNoisemakerAmmo(ammo);
      ingredients = [s.pettySoulGem, s.boneMeal];
      perks = [s.perkSneakThiefsToolbox0];
      this.addCraftingRecipe(ammo, noisemakerAmmo, ingredients, perks);
      var found = this.projectiles.baseStats.find(function (bs) {
        return _this4.names[ammo].includes(bs.identifier) && bs.type !== 'ARROW';
      });

      if (found) {
        this.createCrossbowOnlyVariants(ammo);
      }
    }
  }, {
    key: "createCrossbowOnlyVariants",
    value: function createCrossbowOnlyVariants(ammo) {
      var s = this.statics;
      var ingredients = [];
      var perks = [];
      var fireAmmo = this.createFireAmmo(ammo);
      ingredients = [s.pettySoulGem, s.fireSalt];
      perks = [s.perkEnchantingElementalBombard0];
      this.addCraftingRecipe(ammo, fireAmmo, ingredients, perks);
      var frostAmmo = this.createFrostAmmo(ammo);
      ingredients = [s.pettySoulGem, s.frostSalt];
      perks = [s.perkEnchantingElementalBombard0];
      this.addCraftingRecipe(ammo, frostAmmo, ingredients, perks);
      var shockAmmo = this.createShockAmmo(ammo);
      ingredients = [s.pettySoulGem, s.voidSalt];
      perks = [s.perkEnchantingElementalBombard0];
      this.addCraftingRecipe(ammo, shockAmmo, ingredients, perks);
      var neuralgiaAmmo = this.createNeuralgiaAmmo(ammo);
      ingredients = [s.pettySoulGem, s.deathBell];
      perks = [s.perkEnchantingElementalBombard1];
      this.addCraftingRecipe(ammo, neuralgiaAmmo, ingredients, perks);
      var barbedAmmo = this.createBarbedAmmo(ammo);
      ingredients = [s.ingotSteel, s.deathBell];
      perks = [s.perkMarksmanshipAdvancedMissilecraft1];
      this.addCraftingRecipe(ammo, barbedAmmo, ingredients, perks);
      var heavyweightAmmo = this.createHeavyweightAmmo(ammo);
      ingredients = [s.ingotSteel, s.boneMeal];
      perks = [s.perkMarksmanshipAdvancedMissilecraft2];
      this.addCraftingRecipe(ammo, heavyweightAmmo, ingredients, perks);
    }
  }, {
    key: "addCraftingRecipe",
    value: function addCraftingRecipe(baseAmmo, newAmmo, secondaryIngredients, requiredPerks) {
      var ammoReforgeInputCount = 10;
      var ammoReforgeOutputCount = 10;
      var secondaryIngredientInputCount = 1;
      var newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(newRecipe, 'EDID', "REP_CRAFT_AMMO_".concat(this.names[newAmmo]));
      xelib.AddElement(newRecipe, 'Items');
      var baseItem = xelib.GetElement(newRecipe, 'Items\\[0]');
      xelib.SetValue(baseItem, 'CNTO\\Item', xelib.GetHexFormID(baseAmmo));
      xelib.SetUIntValue(baseItem, 'CNTO\\Count', ammoReforgeInputCount);
      secondaryIngredients.forEach(function (ingredient) {
        var secondaryItem = xelib.AddElement(newRecipe, 'Items\\.');
        xelib.SetValue(secondaryItem, 'CNTO\\Item', ingredient);
        xelib.SetUIntValue(secondaryItem, 'CNTO\\Count', secondaryIngredientInputCount);
      });
      xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
      xelib.AddElementValue(newRecipe, 'NAM1', "".concat(ammoReforgeOutputCount));
      xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(newAmmo));
      xelib.AddElement(newRecipe, 'Conditions');
      requiredPerks.forEach(function (perk, index) {
        var condition;

        if (index === 0) {
          condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
        } else {
          condition = xelib.AddElement(newRecipe, 'Conditions\\.');
        }

        updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
      });
      createGetItemCountCondition(newRecipe, 11000000, ammoReforgeInputCount, baseAmmo);
    }
  }]);

  return ProjectilePatcher;
}();

var WeaponPatcher =
/*#__PURE__*/
function () {
  function WeaponPatcher() {
    _classCallCheck(this, WeaponPatcher);

    this.names = {};
    this.load = this.load.bind(this);
    this.patch = this.patch.bind(this);
    this.checkBroadswordName = this.checkBroadswordName.bind(this);
  } // eslint-disable-next-line no-unused-vars


  _createClass(WeaponPatcher, [{
    key: "load",
    value: function load(plugin, helpers, settings, locals) {
      var _this = this;

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
        filter: function filter(weapon) {
          var name = xelib.FullName(weapon);

          if (name && _this.weapons.excludedWeapons.find(function (e) {
            return name.includes(e);
          })) {
            return false;
          }

          if (xelib.HasElement(weapon, 'KWDA') && xelib.HasArrayItem(weapon, 'KWDA', '', _this.statics.kwWeapTypeStaff)) {
            return false;
          }

          if (xelib.HasElement(weapon, 'CNAM')) {
            return true;
          }

          if (xelib.GetFlag(weapon, 'DNAM\\Flags', 'Non-playable')) {
            return false;
          }

          if (!name) {
            return false;
          }

          return true;
        }
      };
    } // eslint-disable-next-line no-unused-vars

  }, {
    key: "patch",
    value: function patch(weapon, helpers, settings, locals) {
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
  }, {
    key: "checkBroadswordName",
    value: function checkBroadswordName(weapon, enchanted) {
      if (enchanted && !xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeSword)) {
        return;
      }

      if (this.names[weapon].includes('Broadsword')) {
        return;
      }

      this.names[weapon] = this.names[weapon].replace('Sword', 'Broadsword');
      xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
    }
  }, {
    key: "patchBowType",
    value: function patchBowType(weapon, enchanted) {
      var kwda = getKwda(weapon);

      if (!kwda(this.statics.kwWeapTypeBow) || kwda(this.statics.kwWeapTypeCrossbow)) {
        return;
      }

      if (kwda(this.statics.kwWeapTypeLongbow) || kwda(this.statics.kwWeapTypeShortbow)) {
        return;
      }

      var name = this.names[weapon];

      if (enchanted && name.includes('Longbow') || name.includes('Shortbow') || name.includes('Crossbow')) {
        return;
      }

      xelib.AddElementValue(weapon, 'KWDA\\.', this.statics.kwWeapTypeShortbow);

      if (this.names[weapon].includes('Bow')) {
        this.names[weapon] = this.names[weapon].replace('Bow', 'Shortbow');
        xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
      } else {
        this.names[weapon] = "".concat(this.names[weapon], " [Shortbow]");
        xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
      }
    }
  }, {
    key: "checkOverrides",
    value: function checkOverrides(weapon) {
      var type = this.getWeaponTypeOverride(this.names[weapon]);

      if (type) {
        this.names[weapon] = "".concat(this.names[weapon], " [").concat(type, "]");
        xelib.AddElementValue(weapon, 'FULL', this.names[weapon]);
      }

      var override = this.getWeaponMaterialOverrideString(this.names[weapon]);

      if (!override) {
        return;
      }

      if (this.hasWeaponKeyword(weapon)) {
        return;
      }

      var overrideMap = {
        ADVANCED: {
          kwda: this.statics.kwWeapMaterialAdvanced,
          perk: this.statics.perkSmithingAdvanced
        },
        DRAGONBONE: {
          kwda: this.statics.kwWeapMaterialDragonPlate,
          perk: this.statics.perkSmithingDragon
        },
        DAEDRIC: {
          kwda: this.statics.kwWeapMaterialDaedric,
          perk: this.statics.perkSmithingDaedric
        },
        DRAUGR: {
          kwda: this.statics.kwWeapMaterialDraugr,
          perk: this.statics.perkSmithingSteel
        },
        DWARVEN: {
          kwda: this.statics.kwWeapMaterialDwarven,
          perk: this.statics.perkSmithingDwarven
        },
        EBONY: {
          kwda: this.statics.kwWeapMaterialEbony,
          perk: this.statics.perkSmithingEbony
        },
        ELVEN: {
          kwda: this.statics.kwWeapMaterialElven,
          perk: this.statics.perkSmithingElven
        },
        FALMER: {
          kwda: this.statics.kwWeapMaterialFalmer,
          perk: this.statics.perkSmithingAdvanced
        },
        GLASS: {
          kwda: this.statics.kwWeapMaterialGlass,
          perk: this.statics.perkSmithingGlass
        },
        IRON: {
          kwda: this.statics.kwWeapMaterialIron,
          perk: null
        },
        NORDIC: {
          kwda: this.statics.kwWeapMaterialNordic,
          perk: this.statics.perkSmithingAdvanced
        },
        ORCISH: {
          kwda: this.statics.kwWeapMaterialOrcish,
          perk: this.statics.perkSmithingOrcish
        },
        SILVER: {
          kwda: this.statics.kwWeapMaterialSilver,
          perk: this.statics.perkSmithingSilver
        },
        STALHRIM: {
          kwda: this.statics.kwWeapMaterialStalhrim,
          perk: this.statics.perkSmithingAdvanced
        },
        STEEL: {
          kwda: this.statics.kwWeapMaterialSteel,
          perk: this.statics.perkSmithingSteel
        },
        WOODEN: {
          kwda: this.statics.kwWeapMaterialWood,
          perk: null
        }
      };

      if (overrideMap[override]) {
        xelib.AddElementValue(weapon, 'KWDA\\.', overrideMap[override].kwda);
        overrideCraftingRecipes(this.cobj, weapon, overrideMap[override].perk, this.patchFile);
      }
    }
  }, {
    key: "getWeaponTypeOverride",
    value: function getWeaponTypeOverride(name) {
      var override = this.weapons.typeOverrides.find(function (t) {
        return name === t.name;
      });
      return override ? override.type : null;
    }
  }, {
    key: "getWeaponMaterialOverrideString",
    value: function getWeaponMaterialOverrideString(name) {
      var override = this.weapons.materialOverrides.find(function (o) {
        return name.includes(o.substring);
      });
      return override ? override.material : null;
    }
  }, {
    key: "hasWeaponKeyword",
    value: function hasWeaponKeyword(weapon) {
      var s = this.statics;

      var kwda = function kwda(k) {
        return xelib.HasArrayItem(weapon, 'KWDA', '', k);
      };

      return !kwda(s.kwWeapMaterialDaedric) || kwda(s.kwWeapMaterialDragonbone) || kwda(s.kwWeapMaterialDraugr) || kwda(s.kwWeapMaterialDraugrHoned) || kwda(s.kwWeapMaterialDwarven) || kwda(s.kwWeapMaterialEbony) || kwda(s.kwWeapMaterialElven) || kwda(s.kwWeapMaterialFalmer) || kwda(s.kwWeapMaterialFalmerHoned) || kwda(s.kwWeapMaterialGlass) || kwda(s.kwWeapMaterialImperial) || kwda(s.kwWeapMaterialOrcish) || kwda(s.kwWeapMaterialSilver) || kwda(s.kwWeapMaterialSilverRefined) || kwda(s.kwWeapMaterialSteel) || kwda(s.kwWeapMaterialWood) || kwda(s.kwWeapMaterialStalhrim) || kwda(s.kwWeapMaterialNordic);
    }
  }, {
    key: "patchWeaponKeywords",
    value: function patchWeaponKeywords(weapon) {
      var _this2 = this;

      var typeString = getValueFromName(this.weapons.typeDefinitions, this.names[weapon], 'substring', 'binding');

      if (!typeString) {
        this.patchBowType(weapon);
        return;
      }

      var s = this.statics;

      var noop = function noop() {};

      var addp = function addp(w, p) {
        return addPerkScript(w, 'xxxAddPerkWhileEquipped', 'p', p);
      };

      var broad = function broad(w) {
        return _this2.checkBroadswordName(w);
      }; // prettier-ignore


      var weaponKeywordMap = {
        BASTARDSWORD: {
          kwda: s.kwWeapTypeBastardSword,
          func: noop,
          perk: null
        },
        BATTLESTAFF: {
          kwda: s.kwWeapTypeBattlestaff,
          func: noop,
          perk: null
        },
        BROADSWORD: {
          kwda: s.kwWeapTypeBroadsword,
          func: broad,
          perk: null
        },
        CLUB: {
          kwda: s.kwWeapTypeClub,
          func: noop,
          perk: null
        },
        CROSSBOW: {
          kwda: s.kwWeapTypeCrossbow,
          func: noop,
          perk: null
        },
        GLAIVE: {
          kwda: s.kwWeapTypeGlaive,
          func: noop,
          perk: null
        },
        HALBERD: {
          kwda: s.kwWeapTypeHalberd,
          func: noop,
          perk: null
        },
        HATCHET: {
          kwda: s.kwWeapTypeHatchet,
          func: noop,
          perk: null
        },
        KATANA: {
          kwda: s.kwWeapTypeKatana,
          func: noop,
          perk: null
        },
        LONGBOW: {
          kwda: s.kwWeapTypeLongbow,
          func: noop,
          perk: null
        },
        LONGMACE: {
          kwda: s.kwWeapTypeLongmace,
          func: noop,
          perk: null
        },
        LONGSWORD: {
          kwda: s.kwWeapTypeLongsword,
          func: noop,
          perk: null
        },
        MAUL: {
          kwda: s.kwWeapTypeMaul,
          func: noop,
          perk: null
        },
        NODACHI: {
          kwda: s.kwWeapTypeNodachi,
          func: noop,
          perk: null
        },
        SABRE: {
          kwda: s.kwWeapTypeSaber,
          func: noop,
          perk: null
        },
        SCIMITAR: {
          kwda: s.kwWeapTypeScimitar,
          func: noop,
          perk: null
        },
        SHORTBOW: {
          kwda: s.kwWeapTypeShortbow,
          func: noop,
          perk: null
        },
        SHORTSPEAR: {
          kwda: s.kwWeapTypeShortspear,
          func: addp,
          perk: this.statics.perkWeaponShortspear
        },
        SHORTSWORD: {
          kwda: s.kwWeapTypeShortsword,
          func: noop,
          perk: null
        },
        TANTO: {
          kwda: s.kwWeapTypeTanto,
          func: noop,
          perk: null
        },
        UNARMED: {
          kwda: s.kwWeapTypeUnarmed,
          func: noop,
          perk: null
        },
        WAKIZASHI: {
          kwda: s.kwWeapTypeWakizashi,
          func: noop,
          perk: null
        },
        YARI: {
          kwda: s.kwWeapTypeYari,
          func: addp,
          perk: this.statics.perkWeaponYari
        }
      };
      var map = weaponKeywordMap[typeString];

      if (map && xelib.HasElement(weapon, 'KWDA') && !xelib.HasArrayItem(weapon, 'KWDA', '', map.kwda)) {
        xelib.AddArrayItem(weapon, 'KWDA', '', map.kwda);
        map.func(weapon, map.perk);
      }
    }
  }, {
    key: "patchWeaponDamage",
    value: function patchWeaponDamage(weapon) {
      var baseDamage = this.getBaseDamage(weapon);
      var materialDamage = this.getWeaponMaterialDamageModifier(weapon);
      var typeDamage = this.getWeaponTypeDamageModifier(weapon);

      if (baseDamage === null || materialDamage === null || typeDamage === null) {
        var name = this.names[weapon];
        var formId = xelib.GetHexFormID(weapon);
        console.log("".concat(name, "(").concat(formId, "): Base: ").concat(baseDamage, " Material: ").concat(materialDamage, " Type: ").concat(typeDamage));
      }

      xelib.SetUIntValue(weapon, 'DATA\\Damage', baseDamage + materialDamage + typeDamage);
    }
  }, {
    key: "getBaseDamage",
    value: function getBaseDamage(weapon) {
      var s = this.statics;
      var kwda = getKwda(weapon);
      var base = null;

      if (kwda(s.kwWeapTypeSword) || kwda(s.kwWeapTypeWaraxe) || kwda(s.kwWeapTypeMace) || kwda(s.kwWeapTypeDagger)) {
        base = this.settings.weaponBaseStats.damageOneHanded;
      }

      if (kwda(s.kwWeapTypeGreatsword) || kwda(s.kwWeapTypeWarhammer) || kwda(s.kwWeapTypeBattleaxe)) {
        base = this.settings.weaponBaseStats.damageTwoHanded;
      }

      if (kwda(s.kwWeapTypeCrossbow)) {
        base = this.settings.weaponBaseStats.damageCrossbow;
      }

      if (kwda(s.kwWeapTypeBow)) {
        base = this.settings.weaponBaseStats.damageBow;
      }

      if (base === null) {
        var formId = xelib.GetHexFormID(weapon);
        console.log("".concat(this.names[weapon], "(").concat(formId, "): Couldn't set base weapon damage."));
      }

      return base;
    }
  }, {
    key: "getWeaponMaterialDamageModifier",
    value: function getWeaponMaterialDamageModifier(weapon) {
      var modifier = null;
      modifier = getValueFromName(this.weapons.materials, this.names[weapon], 'name', 'damage');

      if (modifier) {
        return modifier;
      }

      modifier = getModifierFromMap(this.keywordMaterialMap, this.weapons.materials, weapon, 'name', 'damage');

      if (modifier === null) {
        var name = this.names[weapon];
        var formId = xelib.GetHexFormID(weapon);
        console.log("".concat(name, "(").concat(formId, "): Couldn't find material damage modifier for weapon."));
      }

      return modifier;
    }
  }, {
    key: "getWeaponTypeDamageModifier",
    value: function getWeaponTypeDamageModifier(weapon) {
      var modifier = getModifierFromMap(this.keywordTypesMap, this.weapons.types, weapon, 'name', 'damage', false);

      if (modifier === null) {
        var name = this.names[weapon];
        var formId = xelib.GetHexFormID(weapon);
        console.log("".concat(name, "(").concat(formId, "): Couldn't find type damage modifier for weapon."));
      }

      return modifier;
    }
  }, {
    key: "patchWeaponReach",
    value: function patchWeaponReach(weapon) {
      var reach = this.getWeaponTypeFloatValueModifier(weapon, 'reach');
      xelib.SetFloatValue(weapon, 'DNAM\\Reach', reach);
    }
  }, {
    key: "patchWeaponSpeed",
    value: function patchWeaponSpeed(weapon) {
      var speed = this.getWeaponTypeFloatValueModifier(weapon, 'speed');
      xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed);
    }
  }, {
    key: "getWeaponTypeFloatValueModifier",
    value: function getWeaponTypeFloatValueModifier(weapon, field2) {
      var modifier = getModifierFromMap(this.skyreTypesMap, this.weapons.types, weapon, 'name', field2, false);

      if (modifier) {
        return modifier;
      }

      modifier = getValueFromName(this.weapons.types, this.names[weapon], 'name', field2, false);

      if (modifier) {
        return modifier;
      }

      modifier = getModifierFromMap(this.vanillaTypesMap, this.weapons.types, weapon, 'name', field2, false);

      if (modifier === null) {
        var name = this.names[weapon];
        var formId = xelib.GetHexFormID(weapon);
        console.log("".concat(name, "(").concat(formId, "): Couldn't find type ").concat(field2, " modifier for weapon."));
      }

      return modifier === null ? 0 : modifier;
    }
  }, {
    key: "modifyRecipes",
    value: function modifyRecipes(weapon) {
      var _this3 = this;

      var weaponFormID = xelib.GetFormID(weapon);
      var weaponIsCrossbow = xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow);
      var excludedCrossbow = this.weapons.excludedCrossbows.find(function (e) {
        return _this3.names[weapon].includes(e);
      });
      this.cobj.forEach(function (recipe) {
        _this3.modifyCrossbowCraftingRecipe(weapon, weaponFormID, weaponIsCrossbow, excludedCrossbow, recipe);

        _this3.modifyTemperingRecipe(weapon, weaponFormID, recipe);
      });
    }
  }, {
    key: "modifyCrossbowCraftingRecipe",
    value: function modifyCrossbowCraftingRecipe(weapon, weaponFormID, weaponIsCrossbow, excludedCrossbow, recipe) {
      if (!weaponIsCrossbow || excludedCrossbow || recipe.cnam !== weaponFormID) {
        return;
      }

      var bench = parseInt(this.statics.kwCraftingSmithingSharpeningWheel, 16);
      var newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);

      if (recipe.bnam !== bench) {
        xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
      }

      xelib.RemoveElement(newRecipe, 'Conditions');
      xelib.AddElement(newRecipe, 'Conditions');
      var condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, this.statics.perkMarksmanshipBallistics);
    }
  }, {
    key: "modifyTemperingRecipe",
    value: function modifyTemperingRecipe(weapon, weaponFormID, recipe) {
      var bnam = recipe.bnam,
          cnam = recipe.cnam;
      var bench = parseInt(this.statics.kwCraftingSmithingSharpeningWheel, 16);

      if (bnam !== bench || cnam !== weaponFormID) {
        return;
      }

      var perk = this.temperingPerkFromKeyword(weapon);

      if (!perk) {
        return;
      }

      var newRecipe = xelib.CopyElement(recipe.handle, this.patchFile);
      var condition = xelib.AddElement(newRecipe, 'Conditions\\^0');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
    }
  }, {
    key: "temperingPerkFromKeyword",
    value: function temperingPerkFromKeyword(weapon) {
      var s = this.statics;
      var kwda = getKwda(weapon); // prettier-ignore

      var keywordPerkMap = [{
        kwda: s.kwWeapMaterialDaedric,
        perk: s.perkSmithingDaedric
      }, {
        kwda: s.kwWeapMaterialDragonbone,
        perk: s.perkSmithingDragon
      }, {
        kwda: s.kwWeapMaterialDraugr,
        perk: s.perkSmithingSteel
      }, {
        kwda: s.kwWeapMaterialDraugrHoned,
        perk: s.perkSmithingSteel
      }, {
        kwda: s.kwWeapMaterialDwarven,
        perk: s.perkSmithingDwarven
      }, {
        kwda: s.kwWeapMaterialEbony,
        perk: s.perkSmithingEbony
      }, {
        kwda: s.kwWeapMaterialElven,
        perk: s.perkSmithingElven
      }, {
        kwda: s.kwWeapMaterialFalmer,
        perk: s.perkSmithingAdvanced
      }, {
        kwda: s.kwWeapMaterialGlass,
        perk: s.perkSmithingGlass
      }, {
        kwda: s.kwWeapMaterialImperial,
        perk: s.perkSmithingSteel
      }, {
        kwda: s.kwWeapMaterialOrcish,
        perk: s.perkSmithingOrcish
      }, {
        kwda: s.kwWeapMaterialSteel,
        perk: s.perkSmithingSteel
      }, {
        kwda: s.kwWeapMaterialSilver,
        perk: s.perkSmithingSilver
      }, {
        kwda: s.kwWeapMaterialSilverRefined,
        perk: s.perkSmithingSilver
      }, {
        kwda: s.kwWeapMaterialNordic,
        perk: s.perkSmithingAdvanced
      }];
      var perk;
      keywordPerkMap.some(function (e) {
        if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
          return false;
        }

        perk = e.perk;
        return true;
      });

      if (!perk && !kwda(s.kwWeapMaterialIron) && !kwda(s.kwWeapMaterialWood)) {
        var name = this.names[weapon];
        var formId = xelib.GetHexFormID(weapon);
        console.log("".concat(name, "(").concat(formId, "): Couldn't determine material - tempering recipe not modified."));
      }

      return perk;
    }
  }, {
    key: "processCrossbow",
    value: function processCrossbow(weapon) {
      var _this4 = this;

      if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapTypeCrossbow)) {
        return;
      }

      if (this.weapons.excludedCrossbows.find(function (e) {
        return _this4.names[weapon].includes(e);
      })) {
        return;
      }

      xelib.AddElementValue(weapon, 'DESC', 'Ignores 50% armor.');
      var requiredPerks = [];
      var secondaryIngredients = [];
      var newName = "Recurve ".concat(this.names[weapon]);
      var newRecurveCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newRecurveCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Arbalest ".concat(this.names[weapon]);
      var newArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newArbalestCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Lightweight ".concat(this.names[weapon]);
      var newLightweightCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newLightweightCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Silenced ".concat(this.names[weapon]);
      var newSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newSilencedCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Recurve Arbalest ".concat(this.names[weapon]);
      var newRecurveArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newRecurveArbalestCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Recurve Lightweight ".concat(this.names[weapon]);
      var newRecurveLightweightCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newRecurveLightweightCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Recurve Silenced ".concat(this.names[weapon]);
      var newRecurveSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newRecurveSilencedCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Lightweight Arbalest ".concat(this.names[weapon]);
      var newLightweightArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newLightweightArbalestCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Silenced Arbalest ".concat(this.names[weapon]);
      var newSilencedArbalestCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newSilencedArbalestCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
      newName = "Lightweight Silenced ".concat(this.names[weapon]);
      var newLightweightSilencedCrossbow = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newLightweightSilencedCrossbow, 'EDID', "REP_WEAPON_".concat(newName));
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
  }, {
    key: "applyRecurveCrossbowChanges",
    value: function applyRecurveCrossbowChanges(weapon) {
      var baseDamage = this.getBaseDamage(weapon);
      var materialDamage = this.getWeaponMaterialDamageModifier(weapon);
      var typeDamage = this.getWeaponTypeDamageModifier(weapon);
      var recurveDamage = this.settings.weaponBaseStats.damageBonusRecurveCrossbow;
      var desc = xelib.GetValue(weapon, 'DESC');
      xelib.SetUIntValue(weapon, 'DATA\\Damage', baseDamage + materialDamage + typeDamage + recurveDamage);
      xelib.AddElementValue(weapon, 'DESC', "".concat(desc, " Deals additional damage."));
    }
  }, {
    key: "applyArbalestCrossbowChanges",
    value: function applyArbalestCrossbowChanges(weapon) {
      var speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
      var weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
      var desc = xelib.GetValue(weapon, 'DESC');
      xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed + this.settings.weaponBaseStats.speedBonusArbalestCrossbow);
      xelib.SetFloatValue(weapon, 'DATA\\Weight', weight + this.settings.weaponBaseStats.weightFactorArbalestCrossbow);
      xelib.AddElementValue(weapon, 'DESC', "".concat(desc, " Deals double damage against blocking enemies but fires slower."));
    }
  }, {
    key: "applyLightweightCrossbowChanges",
    value: function applyLightweightCrossbowChanges(weapon) {
      var speed = xelib.GetIntValue(weapon, 'DNAM\\Speed');
      var weight = xelib.GetIntValue(weapon, 'DATA\\Weight');
      var desc = xelib.GetValue(weapon, 'DESC');
      xelib.SetFloatValue(weapon, 'DNAM\\Speed', speed + this.settings.weaponBaseStats.speedBonusLightweightCrossbow);
      xelib.SetFloatValue(weapon, 'DATA\\Weight', weight + this.settings.weaponBaseStats.weightFactorLightweightCrossbow);
      xelib.AddElementValue(weapon, 'DESC', "".concat(desc, " Has increased attack speed."));
    }
  }, {
    key: "applySilencedCrossbowChanges",
    value: function applySilencedCrossbowChanges(weapon) {
      var desc = xelib.GetValue(weapon, 'DESC');
      xelib.AddElementValue(weapon, 'DESC', "".concat(desc, " Deals increased sneak attack damage."));
    }
  }, {
    key: "processSilverWeapon",
    value: function processSilverWeapon(weapon) {
      if (!xelib.HasArrayItem(weapon, 'KWDA', '', this.statics.kwWeapMaterialSilver)) {
        return;
      }

      var newName = "Refined ".concat(this.names[weapon]);
      var desc = 'These supreme weapons set undead enemies ablaze, dealing extra damage.';
      var newRefinedSilverWeapon = xelib.CopyElement(weapon, this.patchFile, true);
      xelib.AddElementValue(newRefinedSilverWeapon, 'EDID', "REP_WEAPON_".concat(newName));
      xelib.AddElementValue(newRefinedSilverWeapon, 'FULL', newName);
      this.names[newRefinedSilverWeapon] = newName;
      xelib.AddElementValue(newRefinedSilverWeapon, 'DESC', desc);
      xelib.AddElementValue(newRefinedSilverWeapon, 'KWDA\\.', this.statics.kwWeapMaterialSilverRefined);
      this.patchWeaponDamage(newRefinedSilverWeapon);
      this.patchWeaponReach(newRefinedSilverWeapon);
      this.patchWeaponSpeed(newRefinedSilverWeapon);

      if (!xelib.HasElement(newRefinedSilverWeapon, 'VMAD') || !xelib.HasScript(newRefinedSilverWeapon, 'SilverSwordScript')) {
        var vmad = xelib.AddElement(weapon, 'VMAD');
        xelib.SetIntValue(vmad, 'Version', 5);
        xelib.SetIntValue(vmad, 'Object Format', 2);
        var script = xelib.AddElement(vmad, 'Scripts\\.');
        xelib.SetValue(script, 'scriptName', 'SilverSwordScript');
        var property = xelib.AddElement(script, 'Properties\\.');
        xelib.SetValue(property, 'propertyName', 'SilverPerk');
        xelib.SetValue(property, 'Type', 'Object');
        xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', this.statics.perkWeaponSilverRefined);
      }

      this.addTemperingRecipe(newRefinedSilverWeapon);
      var ingredients = [this.statics.ingotGold, this.statics.ingotQuicksilver, xelib.GetHexFormID(newRefinedSilverWeapon)];
      this.addCraftingRecipe(newRefinedSilverWeapon, [this.statics.perkSmithingSilverRefined], ingredients);
      this.addMeltdownRecipe(newRefinedSilverWeapon);
    }
  }, {
    key: "addTemperingRecipe",
    value: function addTemperingRecipe(weapon) {
      var input;
      var perk;
      this.keywordTemperMap.some(function (e) {
        if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
          return false;
        }

        input = e.input;
        perk = e.perk;
        return true;
      });

      if (!input) {
        return;
      }

      var newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(newRecipe, 'EDID', "REP_TEMPER_".concat(this.names[weapon]));
      xelib.AddElement(newRecipe, 'Items');
      var ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
      xelib.SetValue(ingredient, 'CNTO\\Item', input);
      xelib.SetUIntValue(ingredient, 'CNTO\\Count', 1);
      xelib.AddElementValue(newRecipe, 'NAM1', '1');
      xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
      xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingSharpeningWheel);

      if (perk) {
        xelib.AddElement(newRecipe, 'Conditions');
        var condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
        updateHasPerkCondition(newRecipe, condition, 10000000, 1, perk);
      }
    }
  }, {
    key: "addMeltdownRecipe",
    value: function addMeltdownRecipe(weapon) {
      var s = this.statics;
      var kwda = getKwda(weapon);
      var outputQuantity = 1;
      var inputQuantity = 1;
      var input;
      var perk;

      if (kwda(s.kwWeapTypeBattleaxe) || kwda(s.kwWeapTypeGreatsword) || kwda(s.kwWeapTypeWarhammer) || kwda(s.kwWeapTypeBow)) {
        outputQuantity += 1;
      } else if (kwda(s.kwWeapTypeDagger)) {
        inputQuantity += 1;
      }

      this.keywordTemperMap.some(function (e) {
        if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
          return false;
        }

        if (e.kwda === s.kwWeapMaterialDaedric || e.kwda === s.kwWeapMaterialDraugr || e.kwda === s.kwWeapMaterialDraugrHoned) {
          return false;
        }

        input = e.input;
        perk = e.perk;
        return true;
      });

      if (!input) {
        return;
      }

      if (kwda(s.kwWeapMaterialDaedric)) {
        outputQuantity += 1;
      } else if (kwda(s.kwWeapMaterialDraugr) || kwda(s.kwWeapMaterialDraugrHoned)) {
        inputQuantity += 1;
      }

      var newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(newRecipe, 'EDID', "REP_TEMPER_".concat(this.names[weapon]));
      xelib.AddElement(newRecipe, 'Items');
      var ingredient = xelib.GetElement(newRecipe, 'Items\\[0]');
      xelib.SetValue(ingredient, 'CNTO\\Item', input);
      xelib.SetUIntValue(ingredient, 'CNTO\\Count', inputQuantity);
      xelib.AddElementValue(newRecipe, 'NAM1', "".concat(outputQuantity));
      xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
      xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmelter);
      xelib.AddElement(newRecipe, 'Conditions');
      var condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(newRecipe, condition, 10000000, 1, s.perkSmithingMeltdown);

      if (perk) {
        createHasPerkCondition(newRecipe, 10000000, 1, perk);
      }

      createGetItemCountCondition(newRecipe, 11000000, 1, weapon);
    }
  }, {
    key: "addCraftingRecipe",
    value: function addCraftingRecipe(weapon, requiredPerks, secondaryIngredients) {
      var input;
      var perk;
      this.keywordTemperMap.some(function (e) {
        if (!xelib.HasArrayItem(weapon, 'KWDA', '', e.kwda)) {
          return false;
        }

        input = e.input;
        perk = e.perk;
        return true;
      });

      if (!input) {
        return;
      }

      var newRecipe = xelib.AddElement(this.patchFile, 'Constructible Object\\COBJ');
      xelib.AddElementValue(newRecipe, 'EDID', "REP_CRAFT_WEAPON_".concat(this.names[weapon]));
      xelib.AddElement(newRecipe, 'Items');
      var baseItem = xelib.GetElement(newRecipe, 'Items\\[0]');
      xelib.SetValue(baseItem, 'CNTO\\Item', input);
      xelib.SetUIntValue(baseItem, 'CNTO\\Count', 2);
      secondaryIngredients.forEach(function (ingredient) {
        var secondaryItem = xelib.AddElement(newRecipe, 'Items\\.');
        xelib.SetValue(secondaryItem, 'CNTO\\Item', ingredient);
        xelib.SetUIntValue(secondaryItem, 'CNTO\\Count', 1);
      });
      xelib.AddElementValue(newRecipe, 'BNAM', this.statics.kwCraftingSmithingForge);
      xelib.AddElementValue(newRecipe, 'NAM1', '1');
      xelib.AddElementValue(newRecipe, 'CNAM', xelib.GetHexFormID(weapon));
      xelib.AddElement(newRecipe, 'Conditions');
      requiredPerks.forEach(function (p, index) {
        var condition;

        if (index === 0) {
          condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
        } else {
          condition = xelib.AddElement(newRecipe, 'Conditions\\.');
        }

        updateHasPerkCondition(newRecipe, condition, 10000000, 1, p);
      });

      if (perk) {
        createHasPerkCondition(newRecipe, 10000000, 1, perk);
      }
    }
  }, {
    key: "createKeywordMaps",
    value: function createKeywordMaps() {
      var s = this.statics; // prettier-ignore

      this.keywordMaterialMap = [{
        kwda: s.kwWeapMaterialDaedric,
        name: 'Daedric'
      }, {
        kwda: s.kwWeapMaterialDragonbone,
        name: 'Dragonbone'
      }, {
        kwda: s.kwWeapMaterialDraugr,
        name: 'Draugr'
      }, {
        kwda: s.kwWeapMaterialDraugrHoned,
        name: 'Draugr Honed'
      }, {
        kwda: s.kwWeapMaterialDwarven,
        name: 'Dwarven'
      }, {
        kwda: s.kwWeapMaterialEbony,
        name: 'Ebony'
      }, {
        kwda: s.kwWeapMaterialElven,
        name: 'Elven'
      }, {
        kwda: s.kwWeapMaterialFalmer,
        name: 'Daedric'
      }, {
        kwda: s.kwWeapMaterialFalmerHoned,
        name: 'Falmer Honed'
      }, {
        kwda: s.kwWeapMaterialGlass,
        name: 'Glass'
      }, {
        kwda: s.kwWeapMaterialImperial,
        name: 'Imperial'
      }, {
        kwda: s.kwWeapMaterialIron,
        name: 'Iron'
      }, {
        kwda: s.kwWeapMaterialNordic,
        name: 'Nordic'
      }, {
        kwda: s.kwWeapMaterialOrcish,
        name: 'Orcish'
      }, {
        kwda: s.kwWeapMaterialSilver,
        name: 'Silver'
      }, {
        kwda: s.kwWeapMaterialStalhrim,
        name: 'Stalhrim'
      }, {
        kwda: s.kwWeapMaterialSteel,
        name: 'Steel'
      }, {
        kwda: s.kwWeapMaterialWood,
        name: 'Wood'
      }]; // prettier-ignore

      this.skyreTypesMap = [{
        kwda: s.kwWeapTypeBastardSword,
        name: 'Bastard'
      }, {
        kwda: s.kwWeapTypeBattlestaff,
        name: 'Battlestaff'
      }, {
        kwda: s.kwWeapTypeClub,
        name: 'Club'
      }, {
        kwda: s.kwWeapTypeCrossbow,
        name: 'Crossbow'
      }, {
        kwda: s.kwWeapTypeGlaive,
        name: 'Glaive'
      }, {
        kwda: s.kwWeapTypeHalberd,
        name: 'Halberd'
      }, {
        kwda: s.kwWeapTypeHatchet,
        name: 'Hatchet'
      }, {
        kwda: s.kwWeapTypeKatana,
        name: 'Katana'
      }, {
        kwda: s.kwWeapTypeLongbow,
        name: 'Longbow'
      }, {
        kwda: s.kwWeapTypeLongmace,
        name: 'Longmace'
      }, {
        kwda: s.kwWeapTypeLongsword,
        name: 'Longsword'
      }, {
        kwda: s.kwWeapTypeMaul,
        name: 'Maul'
      }, {
        kwda: s.kwWeapTypeNodachi,
        name: 'Nodachi'
      }, {
        kwda: s.kwWeapTypeSaber,
        name: 'Saber'
      }, {
        kwda: s.kwWeapTypeScimitar,
        name: 'Scimitar'
      }, {
        kwda: s.kwWeapTypeShortbow,
        name: 'Shortbow'
      }, {
        kwda: s.kwWeapTypeShortspear,
        name: 'Shortspear'
      }, {
        kwda: s.kwWeapTypeShortsword,
        name: 'Shortsword'
      }, {
        kwda: s.kwWeapTypeTanto,
        name: 'Tanto'
      }, {
        kwda: s.kwWeapTypeUnarmed,
        name: 'Unarmed'
      }, {
        kwda: s.kwWeapTypeWakizashi,
        name: 'Wakizashi'
      }, {
        kwda: s.kwWeapTypeYari,
        name: 'Yari'
      }]; // prettier-ignore

      this.vanillaTypesMap = [{
        kwda: s.kwWeapTypeBattleaxe,
        name: "Battleaxe"
      }, {
        kwda: s.kwWeapTypeBow,
        name: "Bow"
      }, {
        kwda: s.kwWeapTypeSword,
        name: "Broadsword"
      }, {
        kwda: s.kwWeapTypeDagger,
        name: "Dagger"
      }, {
        kwda: s.kwWeapTypeGreatsword,
        name: "Greatsword"
      }, {
        kwda: s.kwWeapTypeMace,
        name: "Mace"
      }, {
        kwda: s.kwWeapTypeWaraxe,
        name: "Waraxe"
      }, {
        kwda: s.kwWeapTypeWarhammer,
        name: "Warhammer"
      }];
      this.keywordTypesMap = this.skyreTypesMap.concat(this.vanillaTypesMap); // prettier-ignore

      this.keywordTemperMap = [{
        kwda: this.statics.kwWeapMaterialDaedric,
        input: s.ingotEbony,
        perk: s.perkSmithingDaedric
      }, {
        kwda: this.statics.kwWeapMaterialDragonbone,
        input: s.dragonBone,
        perk: s.perkSmithingDragon
      }, {
        kwda: this.statics.kwWeapMaterialDraugr,
        input: s.ingotSteel,
        perk: s.perkSmithingSteel
      }, {
        kwda: this.statics.kwWeapMaterialDraugrHoned,
        input: s.ingotSteel,
        perk: s.perkSmithinSteel
      }, {
        kwda: this.statics.kwWeapMaterialDwarven,
        input: s.ingotDwarven,
        perk: s.perkSmithingDwarven
      }, {
        kwda: this.statics.kwWeapMaterialEbony,
        input: s.ingotEbony,
        perk: s.perkSmithingEbony
      }, {
        kwda: this.statics.kwWeapMaterialElven,
        input: s.ingotMoonstone,
        perk: s.perkSmithingElven
      }, {
        kwda: this.statics.kwWeapMaterialFalmer,
        input: s.ingotchaurusChitin,
        perk: null
      }, {
        kwda: this.statics.kwWeapMaterialFalmerHoned,
        input: s.ingotchaurusChitin,
        perk: null
      }, {
        kwda: this.statics.kwWeapMaterialGlass,
        input: s.ingotMalachite,
        perk: s.perkSmithingGlass
      }, {
        kwda: this.statics.kwWeapMaterialImperial,
        input: s.ingotSteel,
        perk: s.perkSmithingSteel
      }, {
        kwda: this.statics.kwWeapMaterialIron,
        input: s.ingotIron,
        perk: null
      }, {
        kwda: this.statics.kwWeapMaterialOrcish,
        input: s.ingotOrichalcum,
        perk: s.perkSmithingOrcish
      }, {
        kwda: this.statics.kwWeapMaterialSilver,
        input: s.ingotSilver,
        perk: s.perkSmithingSilver
      }, {
        kwda: this.statics.kwWeapMaterialSilverRefined,
        input: s.ingotSilver,
        perk: s.perkSmithingSilver
      }, {
        kwda: this.statics.kwWeapMaterialSteel,
        input: s.ingotSteel,
        perk: s.perkSmithingSteel
      }, {
        kwda: this.statics.kwWeapMaterialWood,
        input: s.ingotIron,
        perk: null
      }, {
        kwda: this.statics.kwWeapMaterialStalhrim,
        input: s.oreStalhrim,
        perk: s.perkSmithingAdvanced
      }, {
        kwda: this.statics.kwWeapMaterialNordic,
        input: s.ingotQuicksilver,
        perk: s.perkSmithingAdvanced
      }];
    }
  }]);

  return WeaponPatcher;
}();

var Settings = {
  label: 'Reproccer Reborn',
  templateUrl: '../../../modules/reproccerReborn/settings.html',
  patchFileName: 'ReProccer.esp',
  defaultSettings: {
    patchWeapons: true,
    patchArmor: true,
    patchAlchemyIngredients: true,
    patchProjectiles: true,
    alchemyBaseStats: {
      usePriceLimits: true,
      durationBase: 2,
      priceLimitLower: 5,
      priceLimitUpper: 150
    },
    armorBaseStats: {
      armorFactorBoots: 1,
      armorFactorCuirass: 3,
      armorFactorGauntlets: 1,
      armorFactorHelmet: 1.5,
      armorFactorShield: 1.5,
      protectionPerArmor: 0.1,
      maxProtection: 95
    },
    weaponBaseStats: {
      speedBonusArbalestCrossbow: -0.2,
      speedBonusLightweightCrossbow: 0.25,
      weightFactorArbalestCrossbow: 1.25,
      weightFactorLighweightCrossbow: 0.75,
      damageBow: 22,
      damageCrossbow: 30,
      damageOneHanded: 12,
      damageTwoHanded: 23,
      damageBonusRecurveCrossbow: 8
    },
    requiredFiles: ['SkyRe_Main.esp'],
    ignoredFiles: ['The Huntsman.esp', 'Apocalypse - The Spell Package.esp', 'Lilarcor.esp', 'NPO Module - Crossbows.esp', 'Post Reproccer Scoped Bows Patch.esp', 'brokenmod.esp', 'Bashed Patch, 0.esp', 'Chesko_WearableLantern.esp', 'Chesko_WearableLantern_Guards.esp', 'Chesko_WearableLantern_Caravaner.esp', 'Chesko_WearableLantern_Candle.esp', 'Chesko_WearableLantern_Candle_DG.esp', 'EMCompViljaSkyrim.esp', 'Outfitmerge.esp', 'ReProccerNONPLAYERfix.esp', 'WICskyreFix.esp', 'Dr_Bandolier.esp', 'Dr_BandolierDG.esp', 'BandolierForNPCsCheaperBandoliers.esp', 'BandolierForNPCsCheaperBandoliers_BalancedWeight.esp', 'BandolierForNPCsCheaperBandoliersDawnguard.esp', 'BandolierForNPCsCheaperBandoliers_BalancedWeight_Dawnguard.esp', 'dwarvenrifle.esp', 'j3x-autocrossbows.esp', 'dwavenautorifle1.esp', 'Post ReProccer Fixes CCOR IA7 aMidianSS Content Addon Patch.esp', 'Post ReProccer Fixes CCOR IA7 aMidianSS Patch.esp', 'Post ReProccer Fixes CCOR IA7 IW aMidianSS Content Addon Patch.esp', 'Post ReProccer Fixes CCOR IA7 IW aMidianSS Patch.esp', 'Post ReProccer Fixes CCOR IA7 IW Patch.esp', 'Post ReProccer Fixes CCOR IA7 IW Patch(Personal).esp', 'Post ReProccer Fixes CCOR IA7 IW UU aMidianSS Content Addon Patch.esp', 'Post ReProccer Fixes CCOR IA7 IW UU aMidianSS Patch.esp', 'Post ReProccer Fixes CCOR IA7 IW UU Patch.esp', 'Post ReProccer Fixes CCOR IA7 UU aMidianSS Content Addon Patch.esp', 'Post ReProccer Fixes CCOR IA7 UU aMidianSS Patch.esp', 'Post ReProccer Fixes CCOR IA7 UU Patch.esp', 'Post ReProccer Fixes IA7 aMidianSS Content AddonPatch.esp', 'Post ReProccer Fixes IA7 aMidianSS Patch.esp', 'Post ReProccer Fixes IA7 IW aMidianSS Content AddonPatch.esp', 'Post ReProccer Fixes IA7 IW aMidianSS Patch.esp', 'Post ReProccer Fixes IA7 IW Patch.esp', 'Post ReProccer Fixes IA7 IW UU aMidianSS Content Addon Patch.esp', 'Post ReProccer Fixes IA7 IW UU aMidianSS Patch.esp', 'Post ReProccer Fixes IA7 IW UU Patch.esp', 'Post ReProccer Fixes IA7 Patch.esp', 'Post ReProccer Fixes IA7 UU aMidianSS Content Addon Patch.esp', 'Post ReProccer Fixes IA7 UU aMidianSS Patch.esp', 'Post ReProccer Fixes IA7 UU Patch.esp']
  }
};

var ReproccerReborn =
/*#__PURE__*/
function () {
  function ReproccerReborn(fh, info) {
    var _this = this;

    _classCallCheck(this, ReproccerReborn);

    _defineProperty(this, "initialize", function (patch, helpers, settings, locals) {
      _this.start = new Date();
      console.log("started patching: ".concat(_this.start));
      locals.patch = patch;

      _this.buildRules(locals);

      _this.loadStatics(locals);

      locals.cobj = helpers.loadRecords('COBJ').map(function (handle) {
        return {
          handle: xelib.GetWinningOverride(handle),
          cnam: xelib.GetUIntValue(handle, 'CNAM'),
          bnam: xelib.GetUIntValue(handle, 'BNAM')
        };
      });
    });

    _defineProperty(this, "finalize", function (patch, helpers, settings, locals) {
      var end = new Date();
      console.log("finished patching: ".concat(end));
      console.log("".concat(Math.abs(_this.start - end) / 1000, "s"));
    });

    this.fh = fh;
    this.info = info;
    this.gameModes = [xelib.gmTES5, xelib.gmSSE];
    this.requiredFiles = Settings.requiredFiles;
    this.settings = Settings;
    this.execute = {
      initialize: this.initialize,
      process: [new AlchemyPatcher(), new ArmorPatcher(), new ProjectilePatcher(), new WeaponPatcher()],
      finalize: this.finalize
    };
  }

  _createClass(ReproccerReborn, [{
    key: "getFilesToPatch",
    value: function getFilesToPatch(filenames) {
      return filenames.subtract(['ReProccer.esp']);
    } // eslint-disable-next-line no-unused-vars

  }, {
    key: "loadStatics",
    // eslint-disable-next-line no-unused-vars
    value: function loadStatics(locals) {
      var files = {};
      var loadOrders = {};

      function getFile(filename) {
        if (!files[filename]) {
          files[filename] = xelib.FileByName(filename);
        }

        return files[filename];
      }

      function getLoadOrder(file) {
        if (!loadOrders[file]) {
          loadOrders[file] = xelib.GetFileLoadOrder(file);
        }

        return loadOrders[file];
      }

      function GetHex(formId, filename) {
        var loadOrder = getLoadOrder(getFile(filename));
        return xelib.Hex(loadOrder << 24 | formId);
      }

      locals.statics = {
        // Explosions
        expBarbed: GetHex(0x0c3421, 'SkyRe_Main.esp'),
        expElementalFire: GetHex(0x010d90, 'Dawnguard.esm'),
        expElementalFrost: GetHex(0x010d91, 'Dawnguard.esm'),
        expElementalShock: GetHex(0x010d92, 'Dawnguard.esm'),
        expExploding: GetHex(0x00f952, 'SkyRe_Main.esp'),
        expHeavyweight: GetHex(0x3df04c, 'SkyRe_Main.esp'),
        expNoisemaker: GetHex(0x03a323, 'SkyRe_Main.esp'),
        expNeuralgia: GetHex(0x3df04f, 'SkyRe_Main.esp'),
        expTimebomb: GetHex(0x00f944, 'SkyRe_Main.esp'),
        // Game Settings
        gmstArmorScalingFactor: GetHex(0x021a72, 'Skyrim.esm'),
        gmstMaxArmorRating: GetHex(0x037deb, 'Skyrim.esm'),
        // Items
        ingotCorundum: GetHex(0x05ad93, 'Skyrim.esm'),
        ingotDwarven: GetHex(0x0db8a2, 'Skyrim.esm'),
        ingotEbony: GetHex(0x05ad9d, 'Skyrim.esm'),
        ingotGold: GetHex(0x05ad9e, 'Skyrim.esm'),
        ingotIron: GetHex(0x05ace4, 'Skyrim.esm'),
        ingotMalachite: GetHex(0x05ada1, 'Skyrim.esm'),
        ingotMoonstone: GetHex(0x05ad9f, 'Skyrim.esm'),
        ingotOrichalcum: GetHex(0x05ad99, 'Skyrim.esm'),
        ingotQuicksilver: GetHex(0x05ada0, 'Skyrim.esm'),
        ingotSilver: GetHex(0x05ace3, 'Skyrim.esm'),
        ingotSteel: GetHex(0x05ace5, 'Skyrim.esm'),
        ale: GetHex(0x034c5e, 'Skyrim.esm'),
        boneMeal: GetHex(0x034cdd, 'Skyrim.esm'),
        charcoal: GetHex(0x033760, 'Skyrim.esm'),
        chaurusChitin: GetHex(0x03ad57, 'Skyrim.esm'),
        deathBell: GetHex(0x0516c8, 'Skyrim.esm'),
        dragonbone: GetHex(0x03ada4, 'Skyrim.esm'),
        dragonscale: GetHex(0x03ada3, 'Skyrim.esm'),
        fireSalt: GetHex(0x03ad5e, 'Skyrim.esm'),
        firewood: GetHex(0x06f993, 'Skyrim.esm'),
        frostSalt: GetHex(0x03ad5f, 'Skyrim.esm'),
        leather: GetHex(0x0db5d2, 'Skyrim.esm'),
        leatherStrips: GetHex(0x0800e4, 'Skyrim.esm'),
        netchLeather: GetHex(0x01cd7c, 'Dragonborn.esm'),
        oreStalhrim: GetHex(0x02b06b, 'Dragonborn.esm'),
        pettySoulGem: GetHex(0x02e4e2, 'Skyrim.esm'),
        torchbugThorax: GetHex(0x04da73, 'Skyrim.esm'),
        voidSalt: GetHex(0x03ad60, 'Skyrim.esm'),
        // Keywords
        kwClothingHands: GetHex(0x10cd13, 'Skyrim.esm'),
        kwClothingHead: GetHex(0x10cd11, 'Skyrim.esm'),
        kwClothingFeet: GetHex(0x10cd12, 'Skyrim.esm'),
        kwClothingBody: GetHex(0x0a8657, 'Skyrim.esm'),
        kwArmorClothing: GetHex(0x06bb8, 'Skyrim.esm'),
        kwArmorHeavy: GetHex(0x06bbd2, 'Skyrim.esm'),
        kwArmorLight: GetHex(0x06bbd3, 'Skyrim.esm'),
        kwArmorDreamcloth: GetHex(0x05c2c4, 'SkyRe_Main.esp'),
        kwArmorMaterialBlades: GetHex(0x008255, 'SkyRe_Main.esp'),
        kwArmorMaterialBonemoldHeavy: GetHex(0x024101, 'Dragonborn.esm'),
        kwArmorMaterialDaedric: GetHex(0x06bbd4, 'Skyrim.esm'),
        kwArmorMaterialDarkBrotherhood: GetHex(0x10fd62, 'Skyrim.esm'),
        kwArmorMaterialDawnguard: GetHex(0x012ccd, 'Dawnguard.esm'),
        kwArmorMaterialDragonplate: GetHex(0x06bbd5, 'Skyrim.esm'),
        kwArmorMaterialDragonscale: GetHex(0x06bbd6, 'Skyrim.esm'),
        kwArmorMaterialDraugr: GetHex(0x008257, 'SkyRe_Main.esp'),
        kwArmorMaterialDwarven: GetHex(0x06bbd7, 'Skyrim.esm'),
        kwArmorMaterialEbony: GetHex(0x06bbd8, 'Skyrim.esm'),
        kwArmorMaterialElven: GetHex(0x06bbd9, 'Skyrim.esm'),
        kwArmorMaterialElvenGilded: GetHex(0x06bbda, 'Skyrim.esm'),
        kwArmorMaterialFalmer: GetHex(0x008258, 'SkyRe_Main.esp'),
        kwArmorMaterialFalmerHardened: GetHex(0x012cce, 'Dawnguard.esm'),
        kwArmorMaterialFalmerHeavy: GetHex(0x012ccf, 'Dawnguard.esm'),
        kwArmorMaterialFalmerHeavyOriginal: GetHex(0x012cd0, 'Dawnguard.esm'),
        kwArmorMaterialFur: GetHex(0x008254, 'SkyRe_Main.esp'),
        kwArmorMaterialGlass: GetHex(0x06bbdc, 'Skyrim.esm'),
        kwArmorMaterialHide: GetHex(0x06bbdd, 'Skyrim.esm'),
        kwArmorMaterialHunter: GetHex(0x0050c4, 'Dawnguard.esm'),
        kwArmorMaterialImperialHeavy: GetHex(0x06bbe2, 'Skyrim.esm'),
        kwArmorMaterialImperialLight: GetHex(0x06bbe0, 'Skyrim.esm'),
        kwArmorMaterialImperialStudded: GetHex(0x06bbe1, 'Skyrim.esm'),
        kwArmorMaterialIron: GetHex(0x06bbe3, 'Skyrim.esm'),
        kwArmorMaterialIronBanded: GetHex(0x06bbe4, 'Skyrim.esm'),
        kwArmorMaterialLeather: GetHex(0x06bbdb, 'Skyrim.esm'),
        kwArmorMaterialNightingale: GetHex(0x10fd61, 'Skyrim.esm'),
        kwArmorMaterialNordicHeavy: GetHex(0x024105, 'Dragonborn.esm'),
        kwArmorMaterialOrcish: GetHex(0x06bbe5, 'Skyrim.esm'),
        kwArmorMaterialScaled: GetHex(0x06bbde, 'Skyrim.esm'),
        kwArmorMaterialStalhrimHeavy: GetHex(0x024106, 'Dragonborn.esm'),
        kwArmorMaterialStalhrimLight: GetHex(0x024107, 'Dragonborn.esm'),
        kwArmorMaterialSteel: GetHex(0x06bbe6, 'Skyrim.esm'),
        kwArmorMaterialSteelPlate: GetHex(0x06bbe7, 'Skyrim.esm'),
        kwArmorMaterialStormcloak: GetHex(0x0ac13a, 'Skyrim.esm'),
        kwArmorMaterialStudded: GetHex(0x06bbdf, 'Skyrim.esm'),
        kwArmorMaterialVampire: GetHex(0x01463e, 'Dawnguard.esm'),
        kwArmorShieldHeavy: GetHex(0x08f265, 'SkyRe_Main.esp'),
        kwArmorShieldLight: GetHex(0x08f266, 'SkyRe_Main.esp'),
        kwArmorSlotGauntlets: GetHex(0x06c0ef, 'Skyrim.esm'),
        kwArmorSlotHelmet: GetHex(0x06c0ee, 'Skyrim.esm'),
        kwArmorSlotBoots: GetHex(0x06c0ed, 'Skyrim.esm'),
        kwArmorSlotCuirass: GetHex(0x06c0ec, 'Skyrim.esm'),
        kwArmorSlotShield: GetHex(0x0965b2, 'Skyrim.esm'),
        kwCraftingSmelter: GetHex(0x00a5cce, 'Skyrim.esm'),
        kwCraftingSmithingArmorTable: GetHex(0x0adb78, 'Skyrim.esm'),
        kwCraftingSmithingForge: GetHex(0x088105, 'Skyrim.esm'),
        kwCraftingSmithingSharpeningWheel: GetHex(0x088108, 'Skyrim.esm'),
        kwCraftingTanningRack: GetHex(0x07866a, 'Skyrim.esm'),
        kwJewelry: GetHex(0x08f95a, 'Skyrim.esm'),
        kwMasqueradeBandit: GetHex(0x03a8aa, 'SkyRe_Main.esp'),
        kwMasqueradeForsworn: GetHex(0x03a8a9, 'SkyRe_Main.esp'),
        kwMasqueradeImperial: GetHex(0x037d31, 'SkyRe_Main.esp'),
        kwMasqueradeStormcloak: GetHex(0x037d2f, 'SkyRe_Main.esp'),
        kwMasqueradeThalmor: GetHex(0x037d2b, 'SkyRe_Main.esp'),
        kwVendorItemClothing: GetHex(0x08f95b, 'Skyrim.esm'),
        kwWeapMaterialDaedric: GetHex(0x01e71f, 'Skyrim.esm'),
        kwWeapMaterialDragonbone: GetHex(0x019822, 'Dawnguard.esm'),
        kwWeapMaterialDraugr: GetHex(0x0c5c01, 'Skyrim.esm'),
        kwWeapMaterialDraugrHoned: GetHex(0x0c5c02, 'Skyrim.esm'),
        kwWeapMaterialDwarven: GetHex(0x01e71a, 'Skyrim.esm'),
        kwWeapMaterialEbony: GetHex(0x01e71e, 'Skyrim.esm'),
        kwWeapMaterialElven: GetHex(0x01e71b, 'Skyrim.esm'),
        kwWeapMaterialFalmer: GetHex(0x0c5c03, 'Skyrim.esm'),
        kwWeapMaterialFalmerHoned: GetHex(0x0c5c04, 'Skyrim.esm'),
        kwWeapMaterialGlass: GetHex(0x01e71d, 'Skyrim.esm'),
        kwWeapMaterialImperial: GetHex(0x0c5c00, 'Skyrim.esm'),
        kwWeapMaterialIron: GetHex(0x01e718, 'Skyrim.esm'),
        kwWeapMaterialNordic: GetHex(0x026230, 'Dragonborn.esm'),
        kwWeapMaterialOrcish: GetHex(0x01e71c, 'Skyrim.esm'),
        kwWeapMaterialSilver: GetHex(0x10aa1a, 'Skyrim.esm'),
        kwWeapMaterialSilverRefined: GetHex(0x24f987, 'SkyRe_Main.esp'),
        kwWeapMaterialStalhrim: GetHex(0x02622f, 'Dragonborn.esm'),
        kwWeapMaterialSteel: GetHex(0x01e719, 'Skyrim.esm'),
        kwWeapMaterialWood: GetHex(0x01e717, 'Skyrim.esm'),
        kwWeapTypeBastardSword: GetHex(0x054ff1, 'SkyRe_Main.esp'),
        kwWeapTypeBattleaxe: GetHex(0x06d932, 'Skyrim.esm'),
        kwWeapTypeBattlestaff: GetHex(0x020857, 'SkyRe_Main.esp'),
        kwWeapTypeBow: GetHex(0x01e715, 'Skyrim.esm'),
        kwWeapTypeBroadsword: GetHex(0x05451f, 'SkyRe_Main.esp'),
        kwWeapTypeClub: GetHex(0x09ba23, 'SkyRe_Main.esp'),
        kwWeapTypeCrossbow: GetHex(0x06f3fd, 'Skyrim.esm'),
        kwWeapTypeDagger: GetHex(0x01e713, 'Skyrim.esm'),
        kwWeapTypeGlaive: GetHex(0x09ba40, 'SkyRe_Main.esp'),
        kwWeapTypeGreatsword: GetHex(0x06d931, 'Skyrim.esm'),
        kwWeapTypeHalberd: GetHex(0x09ba3e, 'SkyRe_Main.esp'),
        kwWeapTypeHatchet: GetHex(0x333676, 'SkyRe_Main.esp'),
        kwWeapTypeKatana: GetHex(0x054523, 'SkyRe_Main.esp'),
        kwWeapTypeLongbow: GetHex(0x06f3fe, 'Skyrim.esm'),
        kwWeapTypeLongmace: GetHex(0x0a068f, 'SkyRe_Main.esp'),
        kwWeapTypeLongsword: GetHex(0x054520, 'SkyRe_Main.esp'),
        kwWeapTypeMace: GetHex(0x01e714, 'Skyrim.esm'),
        kwWeapTypeMaul: GetHex(0x333677, 'SkyRe_Main.esp'),
        kwWeapTypeNodachi: GetHex(0x054a88, 'SkyRe_Main.esp'),
        kwWeapTypeSaber: GetHex(0x054a87, 'SkyRe_Main.esp'),
        kwWeapTypeScimitar: GetHex(0x054a87, 'SkyRe_Main.esp'),
        kwWeapTypeShortbow: GetHex(0x056b5f, 'SkyRe_Main.esp'),
        kwWeapTypeShortspear: GetHex(0x1ac2b9, 'SkyRe_Main.esp'),
        kwWeapTypeShortsword: GetHex(0x085067, 'SkyRe_Main.esp'),
        kwWeapTypeStaff: GetHex(0x01e716, 'Skyrim.esm'),
        kwWeapTypeSword: GetHex(0x01e711, 'Skyrim.esm'),
        kwWeapTypeTanto: GetHex(0x054522, 'SkyRe_Main.esp'),
        kwWeapTypeUnarmed: GetHex(0x066f62, 'SkyRe_Main.esp'),
        kwWeapTypeWakizashi: GetHex(0x054521, 'SkyRe_Main.esp'),
        kwWeapTypeWaraxe: GetHex(0x01e712, 'Skyrim.esm'),
        kwWeapTypeWarhammer: GetHex(0x06d930, 'Skyrim.esm'),
        kwWeapTypeYari: GetHex(0x09ba3f, 'SkyRe_Main.esp'),
        // Lights
        lightLightsource: GetHex(0x03a335, 'SkyRe_Main.esp'),
        // Perks
        perkAlchemyFuse: GetHex(0x00feda, 'SkyRe_Main.esp'),
        perkAlchemyAdvancedExplosives: GetHex(0x00fed9, 'SkyRe_Main.esp'),
        perkDreamclothBody: GetHex(0x5cda5, 'SkyRe_Main.esp'),
        perkDreamclothHands: GetHex(0x5cda8, 'SkyRe_Main.esp'),
        perkDreamclothHead: GetHex(0x5cda4, 'SkyRe_Main.esp'),
        perkDreamclothFeet: GetHex(0x5cda7, 'SkyRe_Main.esp'),
        perkEnchantingElementalBombard0: GetHex(0x0af659, 'SkyRe_Main.esp'),
        perkEnchantingElementalBombard1: GetHex(0x3df04e, 'SkyRe_Main.esp'),
        perkMarksmanshipAdvancedMissilecraft0: GetHex(0x0af670, 'SkyRe_Main.esp'),
        perkMarksmanshipAdvancedMissilecraft1: GetHex(0x0af6a4, 'SkyRe_Main.esp'),
        perkMarksmanshipAdvancedMissilecraft2: GetHex(0x3df04d, 'SkyRe_Main.esp'),
        perkMarksmanshipArbalest: GetHex(0x0af6a1, 'SkyRe_Main.esp'),
        perkMarksmanshipBallistics: GetHex(0x0af657, 'SkyRe_Main.esp'),
        perkMarksmanshipEngineer: GetHex(0x0af6a5, 'SkyRe_Main.esp'),
        perkMarksmanshipLightweightConstruction: GetHex(0x0af6a2, 'SkyRe_Main.esp'),
        perkMarksmanshipRecurve: GetHex(0x0af6a0, 'SkyRe_Main.esp'),
        perkMarksmanshipSilencer: GetHex(0x0af6a3, 'SkyRe_Main.esp'),
        perkSmithingAdvanced: GetHex(0x0cb414, 'Skyrim.esm'),
        perkSmithingArcaneBlacksmith: GetHex(0x05218e, 'Skyrim.esm'),
        perkSmithingDaedric: GetHex(0x0cb413, 'Skyrim.esm'),
        perkSmithingDragon: GetHex(0x052190, 'Skyrim.esm'),
        perkSmithingDwarven: GetHex(0x0cb40e, 'Skyrim.esm'),
        perkSmithingEbony: GetHex(0x0cb412, 'Skyrim.esm'),
        perkSmithingElven: GetHex(0x0cb40f, 'Skyrim.esm'),
        perkSmithingGlass: GetHex(0x0cb411, 'Skyrim.esm'),
        perkSmithingLeather: GetHex(0x1d8be6, 'SkyRe_Main.esp'),
        perkSmithingMeltdown: GetHex(0x058f75, 'Skyrim.esm'),
        perkSmithingOrcish: GetHex(0x0cb410, 'Skyrim.esm'),
        perkSmithingSilver: GetHex(0x0581e2, 'Skyrim.esm'),
        perkSmithingSilverRefined: GetHex(0x054ff5, 'SkyRe_Main.esp'),
        perkSmithingSteel: GetHex(0x0cb40d, 'Skyrim.esm'),
        perkSmithingWeavingMill: GetHex(0x05c827, 'SkyRe_Main.esp'),
        perkSneakThiefsToolbox0: GetHex(0x037d35, 'SkyRe_Main.esp'),
        perkWeaponCrossbow: GetHex(0x252122, 'SkyRe_Main.esp'),
        perkWeaponCrossbowArbalest: GetHex(0x0af6a6, 'SkyRe_Main.esp'),
        perkWeaponCrossbowArbalestSilenced: GetHex(0x0af6a8, 'SkyRe_Main.esp'),
        perkWeaponCrossbowSilenced: GetHex(0x0af6a7, 'SkyRe_Main.esp'),
        perkWeaponShortspear: GetHex(0x1ac2ba, 'SkyRe_Main.esp'),
        perkWeaponSilverRefined: GetHex(0x056b5c, 'SkyRe_Main.esp'),
        perkWeaponYari: GetHex(0x09e623, 'SkyRe_Main.esp')
      };
    } // eslint-disable-next-line no-unused-vars

  }, {
    key: "buildRules",
    value: function buildRules(locals) {
      var rules = {};
      var first = fh.loadJsonFile("modules/reproccerReborn/data/first.json", null);
      Object.deepAssign(rules, first);
      xelib.GetLoadedFileNames().forEach(function (plugin) {
        var data = fh.loadJsonFile("modules/reproccerReborn/data/".concat(plugin.slice(0, -4), ".json"), null);

        if (data) {
          Object.deepAssign(rules, data);
        }
      });
      var last = fh.loadJsonFile("modules/reproccerReborn/data/last.json", null);
      Object.deepAssign(rules, last);
      locals.rules = rules;
      console.log(locals.rules);
    }
  }]);

  return ReproccerReborn;
}();

registerPatcher(new ReproccerReborn(fh, info));
