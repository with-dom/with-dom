import { assert, beforeEach, expect, suite, test, vi } from "vitest";
import { getSubscriber, getSubscriberDirectChildren, registerSubscriber, subscribe } from "../lib/subscribers";
import { AppState } from "../lib/types";
import { initialize } from "../lib";
import { libraryState } from "../lib/library_state";

beforeEach(() => {
  initialize({});
});

suite("registerSubscriber", () => {
  test("can register a root subscriber", () => {
    const subFn = (_state: AppState) => 42;
    const subId = registerSubscriber(subFn);

    const { fn, isOutdated, value, dependsOn } = getSubscriber(subId)!;

    expect(libraryState.subscribers.size).toBe(1);

    expect(fn).toBe(subFn);
    expect(isOutdated).toBeTruthy();
    expect(value).toBeUndefined();
    expect(dependsOn.length).toBe(0);
  });

  test("can register a subscriber dependant on a root subscriber", () => {
    const rootSubFn = (_state: AppState) => 42;
    const rootSubId = registerSubscriber(rootSubFn);

    const childSubFn = ([v]: [number]) => {
      return v * v;
    };
    const childSubId = registerSubscriber([rootSubId], childSubFn);

    const rootSub = getSubscriber(rootSubId)!;
    const childSub = getSubscriber(childSubId)!;

    expect(libraryState.subscribers.size).toBe(2);

    expect(rootSub.fn).toBe(rootSubFn);
    expect(rootSub.isOutdated).toBeTruthy();
    expect(rootSub.value).toBeUndefined();
    expect(rootSub.dependsOn.length).toBe(0);

    expect(childSub.fn).toBe(childSubFn);
    expect(childSub.isOutdated).toBeTruthy();
    expect(childSub.value).toBeUndefined();
    expect(childSub.dependsOn.length).toBe(1);
    expect(childSub.dependsOn[0]).toBe(rootSubId);
  });

  test("can register a subscriber dependant on multiple subscribers", () => {
    const rootSubFn1 = (_state: AppState) => 42;
    const rootSubId1 = registerSubscriber(rootSubFn1);

    const rootSubFn2 = (_state: AppState) => "test";
    const rootSubId2 = registerSubscriber(rootSubFn2);

    const childSubFn1 = ([v, s]: [number, string]) => {
      return v + s;
    };
    const childSubId1 = registerSubscriber([rootSubId1, rootSubId2], childSubFn1);

    const childSubFn2 = ([s1, s2]: [string, string]) => {
      return s1 + s2;
    };
    const childSubId2 = registerSubscriber([childSubId1, rootSubId2], childSubFn2);

    const rootSub1 = getSubscriber(rootSubId1)!;
    const rootSub2 = getSubscriber(rootSubId2)!;
    const childSub1 = getSubscriber(childSubId1)!;
    const childSub2 = getSubscriber(childSubId2)!;

    expect(libraryState.subscribers.size).toBe(4);

    expect(rootSub1.fn).toBe(rootSubFn1);
    expect(rootSub1.isOutdated).toBeTruthy();
    expect(rootSub1.value).toBeUndefined();
    expect(rootSub1.dependsOn.length).toBe(0);

    expect(rootSub2.fn).toBe(rootSubFn2);
    expect(rootSub2.isOutdated).toBeTruthy();
    expect(rootSub2.value).toBeUndefined();
    expect(rootSub2.dependsOn.length).toBe(0);

    expect(childSub1.fn).toBe(childSubFn1);
    expect(childSub1.isOutdated).toBeTruthy();
    expect(childSub1.value).toBeUndefined();
    expect(childSub1.dependsOn.length).toBe(2);
    expect(childSub1.dependsOn[0]).toBe(rootSubId1);
    expect(childSub1.dependsOn[1]).toBe(rootSubId2);

    expect(childSub2.fn).toBe(childSubFn2);
    expect(childSub2.isOutdated).toBeTruthy();
    expect(childSub2.value).toBeUndefined();
    expect(childSub2.dependsOn.length).toBe(2);
    expect(childSub2.dependsOn[0]).toBe(childSubId1);
    expect(childSub2.dependsOn[1]).toBe(rootSubId2);
  });

  test("can not register a subscriber that depends multiple times on the same subscriber", () => {
    const rootSubFn = (s: AppState) => 1;
    const rootSubId = registerSubscriber(rootSubFn);

    const childSubFn = ([n]) => 2;
    assert.throws(() => registerSubscriber([rootSubId, rootSubId], childSubFn));

    expect(libraryState.subscribers.size).toBe(1);
  });
});


suite("getSubscriberDirectChildren", () => {
  test("work correctly with root subscriber without children", () => {
    // Register some other root subs
    [1, 2, 3].forEach(() => registerSubscriber(() => { }));

    const subFn = (_state: AppState) => 42;
    const subId = registerSubscriber(subFn);

    const sub = getSubscriber(subId)!;

    expect(getSubscriberDirectChildren(sub).length).toBe(0);
  });

  test("work correctly with complex trees", () => {
    const rootSubFn1 = (_state: AppState) => 42;
    const rootSubId1 = registerSubscriber(rootSubFn1);

    const rootSubFn2 = (_state: AppState) => "test";
    const rootSubId2 = registerSubscriber(rootSubFn2);

    const childSubFn1 = ([v, s]: [number, string]) => {
      return v + s;
    };
    const childSubId1 = registerSubscriber([rootSubId1, rootSubId2], childSubFn1);

    const childSubFn2 = ([s1, s2]: [string, string]) => {
      return s1 + s2;
    };
    const childSubId2 = registerSubscriber([childSubId1, rootSubId2], childSubFn2);

    const childSubFn3 = (_) => {
      return null;
    };
    const childSubId3 = registerSubscriber([childSubId1, childSubId2], childSubFn3);

    const rootSub2 = getSubscriber(rootSubId2)!;

    const deps = getSubscriberDirectChildren(rootSub2);

    expect(deps.length).toBe(2);
    expect(deps[0].id).toBe(childSubId1);
    expect(deps[1].id).toBe(childSubId2);
  });
});

suite("subscribe", () => {
  test("throws if subscriber does not exist", () => {
    assert.throws(() => subscribe(Symbol()));
  });

  test("compute subscriber value only if outdated", () => {
    const rootSubSpyFn = vi.fn(() => {});
    const rootSubId1 = registerSubscriber(rootSubSpyFn);

    expect(getSubscriber(rootSubId1)?.isOutdated).toBeTruthy();

    subscribe(rootSubId1);

    expect(rootSubSpyFn).toHaveBeenCalledExactlyOnceWith(libraryState.appState);
    expect(getSubscriber(rootSubId1)?.isOutdated).toBeFalsy();

    const childSubSpyFn1 = vi.fn(() => {});
    const childSubId1 = registerSubscriber([rootSubId1], childSubSpyFn1);

    expect(getSubscriber(rootSubId1)?.isOutdated).toBeFalsy();
    expect(getSubscriber(childSubId1)?.isOutdated).toBeTruthy();

    subscribe(childSubId1);

    expect(rootSubSpyFn).toHaveBeenCalledExactlyOnceWith(libraryState.appState);
    expect(childSubSpyFn1).toHaveBeenCalledExactlyOnceWith([undefined]);
    expect(getSubscriber(childSubId1)?.isOutdated).toBeFalsy();

    const childSubSpyFn2 = vi.fn(() => {});
    const _childSubId2 = registerSubscriber([childSubId1], childSubSpyFn2);

    subscribe(childSubId1);

    expect(rootSubSpyFn).toHaveBeenCalledExactlyOnceWith(libraryState.appState);
    expect(childSubSpyFn1).toHaveBeenCalledExactlyOnceWith([undefined]);
    expect(childSubSpyFn2).not.toHaveBeenCalled();
  });
});

/* Build complex trees:
  const rootSubIds = Array.from(Array(15)).map(() => registerSubscriber(() => { }));
    const childSubIds = Array.from(Array(100)).reduce<symbol[]>((acc, _) => {
      const choices = new Set(rootSubIds.concat(acc));

      const nbDeps = Math.floor(Math.random() * (choices.size - 1)) + 1;
      const [__, deps] = Array.from(Array(nbDeps)).reduce(([remainingChoices, picked], _) => {
        const randomIndex = Math.floor(Math.random() * (remainingChoices.length - 1)) + 1;

        const pickedId = remainingChoices[randomIndex];

        return [remainingChoices.filter(c => c !== pickedId), picked.concat([pickedId])]
      }, [[...choices], []]);

      const newId = registerSubscriber(deps, () => { });

      return acc.concat([newId]);
    }, []);
 *
 * */
