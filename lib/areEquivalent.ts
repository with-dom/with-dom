function areSameTypes(v1: unknown, v2: unknown): v2 is typeof v1 {
  return typeof v1 === typeof v2;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number";
}

function isFunction(v: unknown): v is () => unknown {
  return typeof v === "function";
}

function isBigInt(v: unknown): v is bigint {
  return typeof v === "bigint";
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isSymbol(v: unknown): v is symbol {
  return typeof v === "symbol";
}

function _areEquivalent(value1: unknown, value2: unknown, stack: unknown[]) {
  // Numbers, strings, null, undefined, symbols, functions, booleans.
  // Also: objects (incl. arrays) that are actually the same instance
  if (value1 === value2) {
    // Fast and done
    return true;
  }

  if (!areSameTypes(value1, value2)) {
    return false;
  }

  // Special case for number: check for NaN on both sides
  // (only way they can still be equivalent but not equal)
  if (isNumber(value1)) {
    // Failed initial equals test, but could still both be NaN
    return (isNaN(value1) && isNaN(value2 as number));
  }

  // Special case for function: check for toString() equivalence
  if (isFunction(value1)) {
    // Failed initial equals test, but could still have equivalent
    // implementations - note, will match on functions that have same name
    // and are native code: `function abc() { [native code] }`
    return value1.toString() === (value2 as () => unknown).toString();
  }

  // For these types, cannot still be equal at this point, so fast-fail
  if (
    isBigInt(value1) || isBoolean(value1) || isString(value1) || isSymbol(value1)
  ) {
    return false;
  }

  // For dates, cast to number and ensure equal or both NaN (note, if same
  // exact instance then we're not here - that was checked above)
  if (value1 instanceof Date) {
    if (!(value2 instanceof Date)) {
      return false;
    }
    // Convert to number to compare
    const asNum1 = +value1, asNum2 = +value2;
    // Check if both invalid (NaN) or are same value
    return asNum1 === asNum2 || (isNaN(asNum1) && isNaN(asNum2));
  }

  // At this point, it's a reference type and could be circular, so
  // make sure we haven't been here before... note we only need to track value1
  // since value1 being un-circular means value2 will either be equal (and not
  // circular too) or unequal whether circular or not.
  if (stack.includes(value1)) {
    throw new Error(`areEquivalent value1 is circular`);
  }

  // breadcrumb
  stack.push(value1);

  // Handle arrays
  if (Array.isArray(value1)) {
    if (!Array.isArray(value2)) {
      return false;
    }

    const length = value1.length;

    if (length !== value2.length) {
      return false;
    }

    for (let i = 0; i < length; i++) {
      if (!_areEquivalent(value1[i], value2[i], stack)) {
        return false;
      }
    }
    return true;
  }

  // Handle Sets
  if (value1 instanceof Set) {
    if (!(value2 instanceof Set)) {
      return false;
    }

    const arrayValue1 = [...value1];
    const arrayValue2 = [...value2];

    const length = arrayValue1.length;

    if (length !== arrayValue2.length) {
      return false;
    }

    for (let i = 0; i < length; i++) {
      if (!_areEquivalent(arrayValue1[i], arrayValue2[i], stack)) {
        return false;
      }
    }

    return true;
  }

  let keys1: string[] = [];
  let keys2: string[] = [];
  let areValuesMaps = false;

  if (value1 instanceof Map) {
    if (!(value2 instanceof Map)) {
      return false;
    }

    areValuesMaps = true;
    keys1 = [...value1.keys()];
    keys2 = [...value2.keys()];
  } else {
    // It's a "normal" object
    keys1 = Object.keys(value1 as object);
    keys2 = Object.keys(value2 as object);
  }

  // get both key lists and check length
  const numKeys = keys1.length;

  if (keys2.length !== numKeys) {
    return false;
  }

  // Empty object on both sides?
  if (numKeys === 0) {
    return true;
  }

  // sort is a native call so it's very fast - much faster than comparing the
  // values at each key if it can be avoided, so do the sort and then
  // ensure every key matches at every index
  keys1.sort();
  keys2.sort();

  // Ensure perfect match across all keys
  for (let i = 0; i < numKeys; i++) {
    if (keys1[i] !== keys2[i]) {
      return false;
    }
  }

  // Ensure perfect match across all values
  for (let i = 0; i < numKeys; i++) {
    const currentKey = keys1[i];
  
    let keyValue1: unknown, keyValue2: unknown;

    if (areValuesMaps) {
      keyValue1 = (value1 as Map<unknown, unknown>).get(currentKey);
      keyValue2 = (value2 as Map<unknown, unknown>).get(currentKey);
    } else {
      keyValue1 = (value1 as Record<string, unknown>)[currentKey];
      keyValue2 = (value2 as Record<string, unknown>)[currentKey];
    }

    if (!_areEquivalent(keyValue1, keyValue2, stack)) {
      return false;
    }
  }

  // back up
  stack.pop();

  // Walk the same, talk the same - matching ducks. Quack.
  // 🦆🦆
  return true;
}

export function areEquivalent(value1: unknown, value2: unknown) {
  return _areEquivalent(value1, value2, []);
}
