export function overrideCraftingRecipes(cobj, armor, perk, patchFile) {
  const armorFormID = xelib.GetFormID(armor);

  cobj.forEach(recipe => {
    if (recipe.cnam !== armorFormID) {
      return;
    }

    const newRecipe = xelib.CopyElement(recipe.handle, patchFile);
    xelib.RemoveElement(newRecipe, 'Conditions');

    if (perk) {
      xelib.AddElement(newRecipe, 'Conditions');
      const condition = xelib.GetElement(newRecipe, 'Conditions\\[0]');
      updateHasPerkCondition(recipe.handle, condition, 10000000, 1, perk);
    }
  });
}

export function createHasPerkCondition(recipe, type, value, perk) {
  const condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateHasPerkCondition(recipe, condition, type, value, perk);
  return condition;
}

export function updateHasPerkCondition(recipe, condition, type, value, perk) {
  xelib.SetValue(condition, 'CTDA\\Type', `${type}`);
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'HasPerk');
  xelib.SetValue(condition, 'CTDA\\Perk', perk);
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}

export function createGetItemCountCondition(recipe, type, value, object) {
  const condition = xelib.AddElement(recipe, 'Conditions\\.');
  updateGetItemCountCondition(recipe, condition, type, value, object);
  return condition;
}

export function updateGetItemCountCondition(recipe, condition, type, value, object) {
  xelib.SetValue(condition, 'CTDA\\Type', `${type}`);
  xelib.SetFloatValue(condition, 'CTDA\\Comparison Value - Float', value);
  xelib.SetValue(condition, 'CTDA\\Function', 'GetItemCount');
  xelib.SetValue(condition, 'CTDA\\Inventory Object', xelib.GetHexFormID(object));
  xelib.SetValue(condition, 'CTDA\\Run On', 'Subject');
}

const includes = (a, b) => a.includes(b);
const equals = (a, b) => a === b;
const compare = (a, b, inclusion) => (inclusion ? includes(a, b) : equals(a, b));

export function getValueFromName(collection, name, field1, field2, inclusion = true) {
  let maxLength = 0;
  let value = null;

  collection.forEach(thing => {
    if (compare(name, thing[field1], inclusion) && thing[field1].length > maxLength) {
      value = thing[field2];
      maxLength = thing[field1].length;
    }
  });

  return value;
}

export function getModifierFromMap(map, collection, handle, field1, field2, inclusion = true) {
  let modifier = null;

  map.some(e => {
    if (!xelib.HasArrayItem(handle, 'KWDA', '', e.kwda)) {
      return false;
    }

    modifier = getValueFromName(collection, e.name, field1, field2, inclusion);
    return true;
  });

  return modifier;
}

export function getKwda(handle) {
  return kwda => xelib.HasArrayItem(handle, 'KWDA', '', kwda);
}

export function addPerkScript(weapon, scriptName, propertyName, perk) {
  const vmad = xelib.AddElement(weapon, 'VMAD');
  xelib.SetIntValue(vmad, 'Version', 5);
  xelib.SetIntValue(vmad, 'Object Format', 2);
  const script = xelib.AddElement(vmad, 'Scripts\\.');
  xelib.SetValue(script, 'scriptName', scriptName);
  const property = xelib.AddElement(script, 'Properties\\.');
  xelib.SetValue(property, 'propertyName', propertyName);
  xelib.SetValue(property, 'Type', 'Object');
  xelib.SetValue(property, 'Flags', 'Edited');
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\FormID', perk);
  xelib.SetValue(property, 'Value\\Object Union\\Object v2\\Alias', 'None');
}
