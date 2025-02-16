import { currentComponent } from "./preact_integration";

import { castDraft, enableMapSet, Immutable, produce } from "immer";
import { Component } from "preact";
import { areEquivalent } from "./areEquivalent";
import {
  AppState,
  EffectHandlerFn,
  EffectHandlerIdentifier,
  Identifier,
  InternalSubscriptionValue,
  SideEffect,
  SideEffectFn,
  SideEffectIdentifier,
  Subscriber,
  SubscriberFn,
  SubscriberIdentifier,
  SubscriptionValue,
} from "./types";

enableMapSet();

let appState: AppState = new Map();
let subscribers: Immutable<
  Map<SubscriberIdentifier, Subscriber<unknown, unknown>>
> = new Map();
let sideEffects: Immutable<Map<SideEffectIdentifier, SideEffect>> = new Map();
let effectHandlers: Immutable<Map<EffectHandlerIdentifier, EffectHandlerFn>> =
  new Map();
let subscriberToComponents: Immutable<Map<Identifier, Component[]>> = new Map();

function registerSubscriber<T>(
  fn: SubscriberFn<AppState, T>,
): SubscriberIdentifier;

function registerSubscriber<T, R>(
  deps: SubscriberIdentifier[],
  fn: SubscriberFn<T, R>,
): SubscriberIdentifier;

function registerSubscriber<T, R>(
  depsOrFn: SubscriberIdentifier[] | SubscriberFn<T, R>,
  fn?: SubscriberFn<T, R>,
): SubscriberIdentifier {
  const id = Symbol("with-dom-subscriber");

  const realFn = (fn || depsOrFn) as SubscriberFn<unknown, unknown>;
  const deps = (fn ? depsOrFn : []) as SubscriberIdentifier[];

  subscribers = produce(subscribers, (subscribers) => {
    subscribers.set(id, {
      id: id,
      dependsOn: deps,
      fn: realFn,
      value: undefined,
      isOutdated: true,
      components: new Set(),
    });
  });

  return id;
}

function registerSideEffect(fn: SideEffectFn): SideEffectIdentifier {
  const id = Symbol("with-dom-side-effect");

  sideEffects = produce(sideEffects, (sideEffects) => {
    sideEffects.set(id, {
      id: id,
      fn: fn,
    });
  });

  return id;
}

function getSubscriberDirectChildren(
  subscriber: Immutable<Subscriber<unknown, unknown>>,
): Immutable<Subscriber<unknown, unknown>[]> {
  return [...subscribers.values()].filter((s) =>
    s.dependsOn.includes(subscriber.id),
  );
}

function getAllSubscribersChildren(
  subscribers: Immutable<Subscriber<unknown, unknown>[]>,
): Immutable<Subscriber<unknown, unknown>[]> {
  return subscribers.reduce(
    (acc, subscriber) => {
      // TODO: Verify stack overflow

      return produce(acc, (acc) => {
        const directChildren = getSubscriberDirectChildren(subscriber);
        acc.push(...castDraft(directChildren));

        const allChildren = getAllSubscribersChildren(directChildren);
        acc.push(...castDraft(allChildren));
      });
    },
    [] as Immutable<Subscriber<unknown, unknown>[]>,
  );
}

const updateAppState = registerSideEffect((newState: AppState) => {
  if (appState === newState) {
    console.error(
      '"updateAppState" has been called without unknown modification.\n' +
        "This is a bad smell and could lead to potential performance issues.",
    );
  }

  const rootSubs = [...subscribers.values()].filter(
    (s) => s.dependsOn.length === 0,
  );

  let outdatedSubs: Immutable<Subscriber<unknown, unknown>[]> = [];

  /**
   * Every time the appState is updated, we compute all of the subscribers
   * that have no dependencies (i.e. the root subs).
   */
  // TODO: Optimize by computing only the root subs that have some subscribers
  //       in their tree
  const updatedRootSubs = rootSubs.map((rootSub) => {
    const newValue = rootSub.fn(newState);

    if (!areEquivalent(rootSub.value, newValue)) {
      outdatedSubs = produce(outdatedSubs, (outdatedSubs) => {
        outdatedSubs.push(...castDraft(getSubscriberDirectChildren(rootSub)));
      });

      // TODO: Fix, does not work
      rootSub.components.forEach((c) => c.setState({}));

      if (subscriberToComponents.has(rootSub.id)) {
        subscriberToComponents.get(rootSub.id)?.forEach((c) => c.setState({}));
      }
    }

    return {
      ...rootSub,
      isOutdated: false,
      value: newValue,
    };
  });

  subscribers = produce(subscribers, (subscribers) => {
    updatedRootSubs.forEach((el) => {
      subscribers.set(el.id, castDraft(el));
    });
  });

  const allOutdatedSubs = outdatedSubs.concat(
    ...getAllSubscribersChildren(outdatedSubs),
  );

  subscribers = produce(subscribers, (subscribers) => {
    allOutdatedSubs.forEach((outdatedSub) => {
      outdatedSub.components.forEach((c) => c.setState({}));

      if (subscriberToComponents.has(outdatedSub.id)) {
        subscriberToComponents
          .get(outdatedSub.id)
          ?.forEach((c) => c.setState({}));
      }

      subscribers.set(
        outdatedSub.id,
        castDraft({
          ...outdatedSub,
          isOutdated: true,
          value: undefined,
        }),
      );
    });
  });

  appState = newState;
});

function registerEffectHandler(fn: EffectHandlerFn): EffectHandlerIdentifier {
  const id = Symbol("with-dom-effect-handler");

  effectHandlers = produce(effectHandlers, (effectHandlers) => {
    effectHandlers.set(id, fn);
  });

  return id;
}

// TODO: How to make it work with type validation?
// TODO: Make it work with async side effects
function executeSideEffect(id: SideEffectIdentifier, ...args: unknown[]): void {
  const sideEffect = sideEffects.get(id);

  if (!sideEffect) {
    throw Error(`Could not find the side-effect`);
  }

  sideEffect.fn(...args);
}

// TODO: How to make it work with type validation?
function dispatchEvent(id: EffectHandlerIdentifier, ...args: unknown[]): void {
  // TODO: should probably be added to a stack to be ensure that each event
  //       is processed only when the previous one is completely finished
  //       i.e. make sure that the rendering happened too

  const handler = effectHandlers.get(id);

  if (!handler) {
    throw Error("Could not find the effect handler");
  }

  const response = handler(appState, ...args);

  Object.getOwnPropertySymbols(response).forEach((effectId) => {
    executeSideEffect(effectId, response[effectId]);
  });
}

/**
 * Retrieves all of the dependencies from the subscribers to the root subscribers.
 * The order of the output matters: from the root of the tree to the leaves
 */
function getAllDependencies(
  subs: Immutable<Subscriber<unknown, unknown>[]>,
): Immutable<Subscriber<unknown, unknown>[]> {
  return subs.reduce(
    (acc, el) => {
      const parents = el.dependsOn.map((s) => {
        const parent = subscribers.get(s);

        if (!parent) {
          throw Error("error");
        }

        return parent;
      });

      return produce(acc, (acc) => {
        acc.push(...castDraft(parents));
        acc.push(...castDraft(getAllDependencies(parents)));
      });
    },
    [] as Immutable<Subscriber<unknown, unknown>[]>,
  );

  // TODO: Put back this, but working:
  const directDeps = subs
    .flatMap((sub) => sub.dependsOn.map((subId) => subscribers.get(subId)))
    .filter((sub) => !!sub);

  return [...getAllDependencies(directDeps), ...directDeps];
}

function computeAllDependenciesValues(
  subscriber: Immutable<Subscriber<unknown, unknown>>,
  ...args: unknown[]
): typeof subscribers {
  const allParents = getAllDependencies([subscriber]);

  return produce(subscribers, (subscribers) => {
    [...allParents].reverse().forEach((parent) => {
      if (!parent.isOutdated) {
        return;
      }

      if (parent.dependsOn.length === 0) {
        subscribers.set(parent.id, {
          ...castDraft(parent),
          value: parent.fn(appState, ...args),
          isOutdated: false,
        });
        return;
      }

      const parents = parent.dependsOn.map((id) => subscribers.get(id));

      subscribers.set(parent.id, {
        ...castDraft(parent),
        value: parent.fn(parents.map((el) => el?.value)), // TODO: There is something wrong with args
        isOutdated: false,
      });
    });
  });
}

function computeSubscriberValue(
  subscriber: Immutable<Subscriber<unknown, unknown>>,
  ...args: unknown[]
): unknown {
  const updatedDeps = computeAllDependenciesValues(subscriber); // TODO: args

  const directDeps = subscriber.dependsOn.map((id) => updatedDeps.get(id));

  const state =
    directDeps.length === 0 ? appState : directDeps.map((el) => el?.value);

  const value = subscriber.fn(state, ...args);

  subscribers = produce(subscribers, (subscribers) => {
    updatedDeps.forEach((u) => {
      subscribers.set(u.id, castDraft(u));
    });

    subscribers.set(subscriber.id, {
      ...castDraft(subscriber),
      value: value,
      isOutdated: false,
    });
  });

  return value;
}

function formatSubscriptionValue<T>(value: T): InternalSubscriptionValue<T> {
  return {
    type: null,
    __b: 0,
    constructor: undefined,
    __type: "with-dom_subscription",
    value: value,
  };
}

function subscribe<T>(
  subscriberId: SubscriberIdentifier,
  ...args: unknown[]
): SubscriptionValue<T> {
  const sub = subscribers.get(subscriberId);

  if (!sub) {
    throw Error("Could not find the related Subscriber");
  }

  if (currentComponent !== undefined) {
    // TODO: Does not work, but the code would be cleaner with this
    //subscribers = produce(subscribers, (subscribers) => {
    //  subscribers.set(subscriberId, {
    //    ...castDraft(sub),
    //    components: castDraft(
    //      produce(sub.components, (components) => {
    //        components.add(castDraft(currentComponent));
    //      })
    //    ),
    //  });
    //})

    const draftComponent = castDraft(currentComponent);

    subscriberToComponents = produce(
      subscriberToComponents,
      (subscriberToComponents) => {
        const prev = subscriberToComponents.get(subscriberId) ?? [];
        prev.push(draftComponent);
        subscriberToComponents.set(subscriberId, prev);
      },
    );
  } else {
    // TODO: Allow to call with a callback fn instead
    console.warn("Subscribe was called outside a reactive context.");
  }

  if (sub.isOutdated) {
    const value = computeSubscriberValue(sub, ...args);
    return formatSubscriptionValue<T>(value as T);
  }

  return formatSubscriptionValue<T>(sub.value as T);
}

export {
  dispatchEvent,
  registerEffectHandler,
  registerSubscriber,
  registerSideEffect,
  subscribe,
  updateAppState,
};
