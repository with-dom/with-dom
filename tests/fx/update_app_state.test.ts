import { beforeEach, expect, suite, test, vi } from "vitest";

import { dispatch, initialize, registerFxHandler, registerSubscriber, updateAppState } from "../../lib";
import { areEquivalent } from "../../lib/are_equivalent";
import { getSubscriber, subscribe } from "../../lib/subscribers";
import { produce } from "immer";
import { libraryState } from "../../lib/library_state";

beforeEach(() => {
  initialize({});
})

test("updateAppState updates the appState", () => {
  const initialState = new Map([["only-in-the-first-map", true]]);
  libraryState.appState = initialState;

  const updatedState = new Map([["only-in-the-2nd-map", false]]);

  const fxHandler = registerFxHandler((_state) => {
    return {
      [updateAppState]: updatedState,
    };
  });

  dispatch(fxHandler);

  expect(areEquivalent(libraryState.appState, updatedState)).toBeTruthy();
});

suite("unchanged state", () => {
  test("updateAppState computes only (but all) the root subscribers", () => {
    const rootSub1 = registerSubscriber<number | undefined>(state => state.get("age") as number);
    const rootSub2 = registerSubscriber<string | undefined>(state => state.get("username") as string)

    const childSub1 = registerSubscriber<[number | undefined], number | undefined>([rootSub1], ([age]) => age ? age * age : undefined);
    const childSub2 = registerSubscriber<[string | undefined], number | undefined>([rootSub2], ([username]) => username ? username.length : undefined);
    const childSub3 = registerSubscriber<[number | undefined, number | undefined], [number, number]>([childSub1, childSub2], ([squaredAge, usernameLength]) => {
      return [squaredAge ?? -1, usernameLength ?? -1];
    });

    const spies = new Map([...libraryState.subscribers.values()].map(s => [s.id, vi.spyOn(s, "fn")]));

    const rootSubIdentifiers = [rootSub1, rootSub2];
    const depsSubIdentifiers = [childSub1, childSub2, childSub3];
    const allSubsIdentifiers = rootSubIdentifiers.concat(depsSubIdentifiers);

    // We subscribe to each to make sure the latest value is computed
    allSubsIdentifiers.forEach(subscribe);

    rootSubIdentifiers.forEach(rs => {
      expect(spies.get(rs)).toHaveBeenCalledTimes(1);
    });

    depsSubIdentifiers.forEach(ds => {
      expect(spies.get(ds)).toHaveBeenCalledTimes(1);
    });

    allSubsIdentifiers.map(getSubscriber).forEach(sub => {
      expect(sub?.isOutdated).toBeFalsy();
    });

    const fxHandler = registerFxHandler((state) => {
      return {
        [updateAppState]: state, // no changes
      };
    });

    dispatch(fxHandler);

    rootSubIdentifiers.forEach(rs => {
      expect(spies.get(rs)).toHaveBeenCalledTimes(2);

      const sub = getSubscriber(rs);

      expect(sub?.isOutdated).toBeFalsy();
    });

    depsSubIdentifiers.forEach(ds => {
      expect(spies.get(ds)).toHaveBeenCalledTimes(1);

      const sub = getSubscriber(ds);

      expect(sub?.isOutdated).toBeFalsy();
    });
  });

  test("updateAppState does not set children as outdated", () => {
    const rootSub1 = registerSubscriber<number | undefined>(state => state.get("age") as number);
    const rootSub2 = registerSubscriber<string | undefined>(state => state.get("username") as string)

    const childSub1 = registerSubscriber<[number | undefined], number | undefined>([rootSub1], ([age]) => age ? age * age : undefined);
    const childSub2 = registerSubscriber<[string | undefined], number | undefined>([rootSub2], ([username]) => username ? username.length : undefined);
    const childSub3 = registerSubscriber<[number | undefined, number | undefined], [number, number]>([childSub1, childSub2], ([squaredAge, usernameLength]) => {
      return [squaredAge ?? -1, usernameLength ?? -1];
    });

    const rootSubIdentifiers = [rootSub1, rootSub2];
    const depsSubIdentifiers = [childSub1, childSub2, childSub3];
    const allSubsIdentifiers = rootSubIdentifiers.concat(depsSubIdentifiers);

    // We subscribe to each to make sure the latest value is computed
    allSubsIdentifiers.forEach(subscribe);

    const fxHandler = registerFxHandler((state) => {
      return {
        [updateAppState]: state, // no changes
      };
    });

    dispatch(fxHandler);

    expect(getSubscriber(childSub1)?.isOutdated).toBeFalsy();
    expect(getSubscriber(childSub2)?.isOutdated).toBeFalsy();
    expect(getSubscriber(childSub3)?.isOutdated).toBeFalsy();
  });
});

suite("changed state", () => {
  test("updateAppState computes only (but all) the root subscribers", () => {
    const rootSub1 = registerSubscriber<number | undefined>(state => state.get("age") as number);
    const rootSub2 = registerSubscriber<string | undefined>(state => state.get("username") as string)

    const childSub1 = registerSubscriber<[number | undefined], number | undefined>([rootSub1], ([age]) => age ? age * age : undefined);
    const childSub2 = registerSubscriber<[string | undefined], number | undefined>([rootSub2], ([username]) => username ? username.length : undefined);
    const childSub3 = registerSubscriber<[number | undefined, number | undefined], [number, number]>([childSub1, childSub2], ([squaredAge, usernameLength]) => {
      return [squaredAge ?? -1, usernameLength ?? -1];
    });

    const spies = new Map([...libraryState.subscribers.values()].map(s => [s.id, vi.spyOn(s, "fn")]));

    const rootSubIdentifiers = [rootSub1, rootSub2];
    const depsSubIdentifiers = [childSub1, childSub2, childSub3];
    const allSubsIdentifiers = rootSubIdentifiers.concat(depsSubIdentifiers);

    // We subscribe to each to make sure the latest value is computed
    allSubsIdentifiers.forEach(subscribe);

    rootSubIdentifiers.forEach(rs => {
      expect(spies.get(rs)).toHaveBeenCalledTimes(1);
    });

    depsSubIdentifiers.forEach(ds => {
      expect(spies.get(ds)).toHaveBeenCalledTimes(1);
    });

    allSubsIdentifiers.map(getSubscriber).forEach(sub => {
      expect(sub?.isOutdated).toBeFalsy();
    });

    const fxHandler = registerFxHandler((state) => {
      return {
        [updateAppState]: produce(state, state => {
          state.set("age", 10);
          state.set("username", "techknow");
        }),
      };
    });

    dispatch(fxHandler);

    rootSubIdentifiers.forEach(rs => {
      expect(spies.get(rs)).toHaveBeenCalledTimes(2);

      const sub = getSubscriber(rs);

      expect(sub?.isOutdated).toBeFalsy();
    });

    depsSubIdentifiers.forEach(ds => {
      expect(spies.get(ds)).toHaveBeenCalledTimes(1);

      const sub = getSubscriber(ds);

      expect(sub?.isOutdated).toBeTruthy();
    });
  });

  test("updateAppState sets children as outdated", () => {
    const rootSub1 = registerSubscriber<number | undefined>(state => state.get("age") as number);
    const rootSub2 = registerSubscriber<string | undefined>(state => state.get("username") as string)

    const childSub1 = registerSubscriber<[number | undefined], number | undefined>([rootSub1], ([age]) => age ? age * age : undefined);
    const childSub2 = registerSubscriber<[string | undefined], number | undefined>([rootSub2], ([username]) => username ? username.length : undefined);
    const childSub3 = registerSubscriber<[number | undefined, number | undefined], [number, number]>([childSub1, childSub2], ([squaredAge, usernameLength]) => {
      return [squaredAge ?? -1, usernameLength ?? -1];
    });

    const rootSubIdentifiers = [rootSub1, rootSub2];
    const depsSubIdentifiers = [childSub1, childSub2, childSub3];
    const allSubsIdentifiers = rootSubIdentifiers.concat(depsSubIdentifiers);

    // We subscribe to each to make sure the latest value is computed
    allSubsIdentifiers.forEach(subscribe);

    const fxHandler = registerFxHandler((state) => {
      return {
        [updateAppState]: produce(state, state => {
          state.set("username", "techknow");
        }),
      };
    });

    dispatch(fxHandler);

    expect(getSubscriber(childSub1)?.isOutdated).toBeFalsy();
    expect(getSubscriber(childSub2)?.isOutdated).toBeTruthy();
    expect(getSubscriber(childSub3)?.isOutdated).toBeTruthy();
  });
});
