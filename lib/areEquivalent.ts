function _areEquivalent(value1: any, value2: any, stack: any[]) {
  // Numbers, strings, null, undefined, symbols, functions, booleans.
  // Also: objects (incl. arrays) that are actually the same instance
  if (value1 === value2) {
    // Fast and done
    return true;
  }

  const type1 = typeof value1;

  // Ensure types match
  if (type1 !== typeof value2) {
    return false;
  }

  // Special case for number: check for NaN on both sides
  // (only way they can still be equivalent but not equal)
  if (type1 === 'number') {
    // Failed initial equals test, but could still both be NaN
    return (isNaN(value1) && isNaN(value2));
  }

  // Special case for function: check for toString() equivalence
  if (type1 === 'function') {
    // Failed initial equals test, but could still have equivalent
    // implementations - note, will match on functions that have same name
    // and are native code: `function abc() { [native code] }`
    return value1.toString() === value2.toString();
  }

  // For these types, cannot still be equal at this point, so fast-fail
  if (
    type1 === 'bigint' || type1 === 'boolean' || type1 === 'string' ||
    type1 === 'symbol'
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
  let isMap = false;

  if (value1 instanceof Map) {
    if (!(value2 instanceof Map)) {
      return false;
    }

    isMap = true;
    keys1 = [...value1.keys()];
    keys2 = [...value2.keys()];
  } else {
    // It's a "normal" object
    keys1 = Object.keys(value1);
    keys2 = Object.keys(value2);
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
    const keyValue1 = isMap ? value1.get(currentKey) : value1[currentKey];
    const keyValue2 = isMap ? value2.get(currentKey) : value2[currentKey];

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

export function areEquivalent(value1: any, value2: any) {
  return _areEquivalent(value1, value2, []);
}
