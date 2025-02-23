import { expect, suite, test } from "vitest";
import { areEquivalent } from "../../lib/utils/are_equivalent";

suite("areEquivalent", () => {
  suite("Primitive types", () => {
    const globalSymbol = Symbol();

    test.each([
      [1, 1],
      ["a", "a"],
      [true, true],
      [3e2, 300],
      ["x", "x"],
      [undefined, undefined],
      [null, null],
      [0n, 0n],
      [0, -0],
      [
        BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      ],
      [NaN, NaN],
      [Infinity, Infinity],
      [globalSymbol, globalSymbol],
    ])("%s and %s (same type) are equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeTruthy();
    });

    test.each([])("%s and %s (different type) are equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeTruthy();
    });

    test.each([
      [Symbol(), Symbol()],
      [Symbol("whatever"), Symbol("whatever")],
      ["", " "],
      ["a ", "a"],
      [" a", "a"],
      ["a", "b"],
      ["1", 1],
      ["false", false],
      [1, true],
      [0, false],
      [1, 2],
      [-1, 1],
      [1n, 1],
      [true, false],
      [undefined, null],
      [NaN, null],
      [NaN, undefined],
      [1e100000000000, NaN],
      [Infinity, NaN],
    ])("%s and %s are not equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeFalsy();
    });
  });

  suite("Dates", () => {
    test("same dates are equivalent", () => {
      const date = new Date();

      expect(areEquivalent(date, date)).toBeTruthy();

      expect(
        areEquivalent(new Date("2025-01-01"), new Date("2025-01-01")),
      ).toBeTruthy();

      expect(
        areEquivalent(
          new Date("2025-01-01T10:00+00:00"),
          new Date("2025-01-01T09:00-01:00"),
        ),
      ).toBeTruthy();

      expect(
        areEquivalent(new Date("invalid"), new Date("invalid2")),
      ).toBeTruthy();
    });

    test("different dates are not equivalent", () => {
      expect(areEquivalent(new Date(), "not-a-date"));
      expect(
        areEquivalent(
          new Date("2025-01-01T02:00"),
          new Date("2025-01-01T02:01"),
        ),
      ).toBeFalsy();
    });
  });

  suite("Arrays", () => {
    test("same instances are equivalent", () => {
      const arrA: unknown[] = [];

      expect(areEquivalent(arrA, arrA)).toBeTruthy();

      const arrB = [];

      expect(areEquivalent(arrB, arrB)).toBeTruthy();
    });

    test.each([
      [[], []],
      [
        [1, 2],
        [1, 2],
      ],
      [[[[]]], [[[]]]],
      [
        [true, null],
        [true, null],
      ],
    ])("%s and %s are equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeTruthy();
    });

    test.each([
      [[], [1]],
      [[[[]]], [[[[]]]]],
      [
        [1, 2],
        [2, 1],
      ],
      [[, ,], new Array(3)],
      [[], "not-an-array"],
    ])("%s and %s are not equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeFalsy();
    });

    test("handles circular dependencies", () => {
      const arrA: unknown[] = [1];
      const arrB: unknown[] = [1, arrA];

      arrA.push(arrB);

      expect(areEquivalent(arrA, arrB)).toBeFalsy();
    });
  });

  suite("objects", () => {
    test("which are equivalent", () => {
      const objA = {};

      expect(areEquivalent(objA, objA)).toBeTruthy();

      const objB = new Object();

      expect(areEquivalent(objA, objB)).toBeTruthy();

      class Rectangle {
        height: number;
        width: number;
        constructor(height: number, width: number) {
          this.height = height;
          this.width = width;
        }
      }

      expect(
        areEquivalent(new Rectangle(10, 11), new Rectangle(10, 11)),
      ).toBeTruthy();

      expect(
        areEquivalent({ height: 10, width: 11 }, new Rectangle(10, 11)),
      ).toBeTruthy();
    });

    test("which are not equivalent", () => {
      class Rectangle {
        height: number;
        width: number;
        constructor(height: number, width: number) {
          this.height = height;
          this.width = width;
        }
      }

      expect(
        areEquivalent(new Rectangle(10, 11), new Rectangle(100, 200)),
      ).toBeFalsy();
      expect(
        areEquivalent({ height: 20, width: 11 }, new Rectangle(10, 11)),
      ).toBeFalsy();
    });

    test.each([
      [{}, {}],
      [{ a: 1 }, { a: 1 }],
      [{ a: { a: 1 } }, { a: { a: 1 } }],
    ])("%s and %s are equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeTruthy();
    });

    test.each([
      [{ a: 1 }, { a: 2 }],
      [{}, { a: 1 }],
    ])("%s and %s are not equivalent", (a, b) => {
      expect(areEquivalent(a, b)).toBeFalsy();
    });

    test("handles circular dependencies", () => {
      const objA: Record<string, unknown> = {};
      const objB = { a: objA };

      objA["a"] = objB;

      expect(areEquivalent(objA, objB)).toBeFalsy();
    });
  });

  suite("Functions", () => {
    test("same instances are equivalent", () => {
      const fn = () => {};

      expect(areEquivalent(fn, fn)).toBeTruthy();

      function testFn() {}

      expect(areEquivalent(testFn, testFn)).toBeTruthy();

      const nonEmptyFn = (num: number) => {
        return num * num;
      };

      expect(areEquivalent(nonEmptyFn, nonEmptyFn)).toBeTruthy();

      const that = {};

      expect(
        areEquivalent(nonEmptyFn.bind(that), nonEmptyFn.bind(that)),
      ).toBeTruthy();
    });

    test("different instances which are equivalent", () => {
      const fnA = (_a: any, ..._args: any[]) => {
        return "it's the same, I promise!";
      };
      const fnB = (_a: any, ..._args: any[]) => {
        // A comment
        return "it's the same, I promise!";
      };

      expect(areEquivalent(fnA, fnB)).toBeTruthy();

      let outOfScope = 3;

      const fnC = (_a: any, ..._args: any[]) => {
        return outOfScope;
      };

      outOfScope = 4;
      const fnD = (_a: any, ..._args: any[]) => {
        return outOfScope;
      };

      expect(areEquivalent(fnC, fnD)).toBeTruthy();
    });

    test("different instances which are not equivalent", () => {
      const fnA = () => {};
      function fnB() {}

      expect(areEquivalent(fnA, fnB)).toBeFalsy();

      function fnC() {
        return "it's the same, I promise!";
      }

      function fnD() {
        return "it's the same, I promise!";
      }

      expect(areEquivalent(fnC, fnD), "because of their names").toBeFalsy();

      const fnE = (_a: any) => {};
      const fnF = (_b: any) => {};

      expect(areEquivalent(fnE, fnF)).toBeFalsy();

      const fnG = () => {
        return;
      };
      const fnH = () => {};

      expect(areEquivalent(fnG, fnH)).toBeFalsy();

      const fnI = () => 1;
      const fnJ = () => {
        return 1;
      };

      expect(areEquivalent(fnI, fnJ)).toBeFalsy();
    });
  });

  suite("Maps", () => {
    test("same instances are equivalent", () => {
      const map = new Map();

      expect(areEquivalent(map, map)).toBeTruthy();

      map.set("key", "value");

      expect(areEquivalent(map, map)).toBeTruthy();
    });

    test("different instances with same entries are equivalent", () => {
      const mapA = new Map();
      const mapB = new Map();

      expect(areEquivalent(mapA, mapB)).toBeTruthy();

      [mapA, mapB].forEach((m) => m.set("key", "value"));

      expect(areEquivalent(mapA, mapB)).toBeTruthy();

      [mapA, mapB].forEach((m) => m.set(null, true));

      expect(areEquivalent(mapA, mapB)).toBeTruthy();

      [mapA, mapB].forEach((m) => m.delete(null));

      expect(areEquivalent(mapA, mapB)).toBeTruthy();

      [mapA, mapB].forEach((m) => m.clear());

      expect(areEquivalent(mapA, mapB)).toBeTruthy();

      [mapA, mapB].forEach((m) => m.set({}, () => {}));

      expect(areEquivalent(mapA, mapB)).toBeTruthy();
    });

    test("different instances with different entries are not equivalent", () => {
      const mapA = new Map();
      const mapB = new Map();

      mapA.set(false, 3);

      expect(areEquivalent(mapA, mapB)).toBeFalsy();

      mapA.clear();
      [mapA, mapB].forEach((m) => {
        m.set(null, true);
        m.set("1", 3);
        m.set(false, undefined);
      });
      mapA.set(null, false);

      expect(areEquivalent(mapA, mapB), "different values").toBeFalsy();

      mapA.clear();
      [mapA, mapB].forEach((m) => {
        m.set(null, true);
        m.set("1", 3);
        m.set(false, undefined);
      });
      mapA.set(undefined, false);

      expect(areEquivalent(mapA, mapB), "different keys").toBeFalsy();

      mapA.clear();
      [mapA, mapB].forEach((m) => {
        m.set(null, true);
        m.set("1", 3);
        m.set(false, undefined);
      });
      mapA.set(undefined, false);
      mapB.set(undefined, true);

      expect(areEquivalent(mapA, mapB), "different keys").toBeFalsy();

      expect(areEquivalent(new Map(), "not a map")).toBeFalsy();
    });
  });

  suite("Sets", () => {
    test("same instances are equivalent", () => {
      const set = new Set();

      expect(areEquivalent(set, set)).toBeTruthy();

      set.add("");

      expect(areEquivalent(set, set)).toBeTruthy();
    });

    test("different instances with same values are equivalent", () => {
      const setA = new Set();
      const setB = new Set();

      expect(areEquivalent(setA, setB)).toBeTruthy();

      [setA, setB].forEach((s) => s.add(1));

      expect(areEquivalent(setA, setB)).toBeTruthy();

      [setA, setB].forEach((s) => s.add(undefined));

      expect(areEquivalent(setA, setB)).toBeTruthy();
    });

    test("different instances with different entries are not equivalent", () => {
      const setA = new Set();
      const setB = new Set();

      setA.add(false);

      expect(areEquivalent(setA, setB)).toBeFalsy();

      setA.clear();
      [setA, setB].forEach((s) => {
        s.add(null);
        s.add("1");
        s.add(false);
      });
      setA.add(3);

      expect(areEquivalent(setA, setB)).toBeFalsy();

      setA.clear();
      [setA, setB].forEach((s) => {
        s.add(null);
        s.add("1");
        s.add(false);
      });
      setA.add(3);
      setB.add(4);

      expect(areEquivalent(setA, setB)).toBeFalsy();

      expect(areEquivalent(new Set(), "not-an-array")).toBeFalsy();
    });
  });
});
