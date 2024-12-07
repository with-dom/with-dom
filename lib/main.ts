import { currentComponent, withDomTypeIdentifier } from "./preact_integration";

import { castDraft, enableMapSet, Immutable, produce } from "immer";
import { Component } from "preact";

enableMapSet();

export type AppState = Immutable<Map<string | symbol, any>>;
export type Identifier = symbol;
export type SubscriberIdentifier = Identifier;
export type SideEffectIdentifier = Identifier;
export type EffectHandlerIdentifier = Identifier;
export interface SubscriptionValue<T> {
  readonly value: T;
}
export type Subscription<T> = {
  readonly __subscriberId: SubscriberIdentifier;
  readonly value: SubscriptionValue<T>;
}

/**
 * Specific to preact
 */
interface InternalSubscriptionValue<T> extends SubscriptionValue<T> {
  readonly type: null;
  readonly __b: number;
  readonly constructor: undefined;
  readonly __type: typeof withDomTypeIdentifier;
}

type SubscriberFn<T, R> = (stateOrDeps: T, ...args: any[]) => R;
type Subscriber<T, R> = {
  readonly id: Identifier;
  readonly dependsOn: SubscriberIdentifier[];
  readonly fn: SubscriberFn<T, R>;
  readonly value: any;
  readonly isOutdated: boolean;
  readonly components: Set<Component>;
};

type SideEffectFn = (...args: any[]) => void;
type SideEffect = {
  readonly id: Identifier;
  readonly fn: SideEffectFn;
};

export type EffectHandlerResponse = {
  readonly [key: Identifier]: any;
};
export type EffectHandlerFn = (appState: AppState, ...args: any[]) => EffectHandlerResponse;

let appState: AppState = new Map();
let subscribers: Immutable<Map<SubscriberIdentifier, Subscriber<any, any>>> = new Map();
let sideEffects: Immutable<Map<SideEffectIdentifier, SideEffect>> = new Map();
let effectHandlers: Immutable<Map<EffectHandlerIdentifier, EffectHandlerFn>> = new Map();
let subscriberToComponents: Immutable<Map<Identifier, Component[]>> = new Map();

function registerSubscriber<T>(
  fn: SubscriberFn<AppState, T>
): SubscriberIdentifier;

function registerSubscriber<T, R>(
  deps: SubscriberIdentifier[],
  fn: SubscriberFn<T, R>
): SubscriberIdentifier;

function registerSubscriber<T, R>(
  depsOrFn: SubscriberIdentifier[] | SubscriberFn<T, R>,
  fn?: SubscriberFn<T, R>
): SubscriberIdentifier {
  const id = Symbol("with-dom-subscriber");

  const realFn = (fn || depsOrFn) as SubscriberFn<T, R>;
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
  subscriber: Immutable<Subscriber<any, any>>
): Immutable<Subscriber<any, any>[]> {
  return [
    ...subscribers.values(),
  ].filter(s => s.dependsOn.includes(subscriber.id));
}

function getAllSubscribersChildren(
  subscribers: Immutable<Subscriber<any, any>[]>
): Immutable<Subscriber<any, any>[]> {
  return subscribers.reduce((acc, subscriber) => {

    // TODO: Verify stack overflow

    return produce(acc, (acc) => {
      const directChildren = getSubscriberDirectChildren(subscriber);
      acc.push(...castDraft(directChildren));

      const allChildren = getAllSubscribersChildren(directChildren);
      acc.push(...castDraft(allChildren));
    });
  }, [] as Immutable<Array<Subscriber<any, any>>>);
}

const updateAppState = registerSideEffect((newState: AppState) => {
  if (appState === newState) {
    console.error(
      "\"updateAppState\" has been called without any modification.\n" +
      "This is a bad smell and could lead to potential performance issues."
    );
  }

  appState = newState;

  const rootSubs = [...subscribers.values()].filter(s => s.dependsOn.length === 0);

  let outdatedSubs: Immutable<Subscriber<any, any>[]> = [];

  /**
   * Every time the appState is updated, we compute all of the subscribers
   * that have no dependencies (i.e. the root subs).
   */
  // TODO: Optimize by computing only the root subs that have some subscribers
  //       in their tree
  const updatedRootSubs = rootSubs.map(rootSub => {
    if (rootSub.isOutdated) {
      return rootSub;
    }

    const newValue = rootSub.fn(appState);

    // TODO: because of this check, we have to make sure that every value in 
    //       the state can be diffed this way (i.e. only primitives + immutable)
    if (rootSub.value !== newValue) {

      outdatedSubs = produce(outdatedSubs, (outdatedSubs) => {
        outdatedSubs.push(...castDraft(getSubscriberDirectChildren(rootSub)));
      });

      // TODO: Fix, does not work
      rootSub.components.forEach(c => c.setState({}));

      if (subscriberToComponents.has(rootSub.id)) {
        subscriberToComponents.get(rootSub.id)!.forEach(c => c.setState({}));
      }
    }

    return {
      ...rootSub,
      isOutdated: false,
      value: newValue,
    };
  });

  subscribers = produce(subscribers, (subscribers) => {
    updatedRootSubs.forEach(el => {
      subscribers.set(el.id, castDraft(el));
    });
  });

  const allOutdatedSubs = outdatedSubs.concat(
    ...getAllSubscribersChildren(outdatedSubs)
  );

  subscribers = produce(subscribers, (subscribers) => {
    allOutdatedSubs.forEach(outdatedSub => {
      outdatedSub.components.forEach(c => c.setState({}));

      if (subscriberToComponents.has(outdatedSub.id)) {
        subscriberToComponents.get(outdatedSub.id)!.forEach(c => c.setState({}));
      }

      subscribers.set(outdatedSub.id, castDraft({
        ...outdatedSub,
        isOutdated: true,
        value: undefined,
      }));
    })
  });
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
function executeSideEffect(id: SideEffectIdentifier, ...args: any[]): void {
  const sideEffect = sideEffects.get(id);

  if (!sideEffect) {
    throw Error(`Could not find the side-effect`);
  }

  sideEffect.fn(...args);
}

// TODO: How to make it work with type validation?
function dispatchEvent(id: EffectHandlerIdentifier, ...args: any[]): void {
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
  subs: Immutable<Subscriber<any, any>[]>
): Immutable<Subscriber<any, any>[]> {
  return subs.reduce((acc, el) => {
    const parents = el.dependsOn.map(s => {
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
  }, [] as Immutable<Subscriber<any, any>[]>);


  // TODO: Put back this, but working:
  const directDeps = subs
    .flatMap(sub => sub.dependsOn.map(subId => subscribers.get(subId)))
    .filter(sub => !!sub);

  return [
    ...getAllDependencies(directDeps),
    ...directDeps,
  ];
}

function computeAllDependenciesValues(
  subscriber: Immutable<Subscriber<any, any>>,
  ...args: any[]
): typeof subscribers {
  const allParents = getAllDependencies([subscriber]);

  return produce(subscribers, (subscribers) => {
    [...allParents].reverse().forEach(parent => {
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

      const parents = parent.dependsOn.map(id => subscribers.get(id));

      subscribers.set(parent.id, {
        ...castDraft(parent),
        value: parent.fn(parents.map(el => el?.value)), // TODO: There is something wrong with args
        isOutdated: false,
      });
    });
  });
}

function computeSubscriberValue(subscriber: Immutable<Subscriber<any, any>>, ...args: any[]): any {
  const updatedDeps = computeAllDependenciesValues(subscriber); // TODO: args

  const directDeps = subscriber.dependsOn.map(id => updatedDeps.get(id));

  const state = directDeps.length === 0
    ? appState
    : directDeps.map(el => el?.value);

  const value = subscriber.fn(state, ...args);

  subscribers = produce(subscribers, (subscribers) => {
    updatedDeps.forEach(u => {
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
    __type: withDomTypeIdentifier,
    value: value,
  };
}

function subscribe<T>(
  subscriberId: SubscriberIdentifier,
  ...args: any[]
): Immutable<Subscription<T>> {
  return {
    get value(): Immutable<InternalSubscriptionValue<T>> {
      const sub = subscribers.get(this.__subscriberId);

      if (!sub) {
        throw Error("Could not find the related Subscriber");
      }

      if (currentComponent) {
        // TODO: Is erased

        subscribers = produce(subscribers, (subscribers) => {
          subscribers.set(this.__subscriberId, {
            ...castDraft(sub),
            components: castDraft(
              produce(sub.components, (components) => {
                components.add(castDraft(currentComponent!));
              })
            ),
          });
        })

        subscriberToComponents = produce(subscriberToComponents, (subscriberToComponents) => {
          const prev = subscriberToComponents.get(this.__subscriberId) ?? [];
          prev.push(castDraft(currentComponent!));
          subscriberToComponents.set(this.__subscriberId, prev);
        });
      } else {
        // TODO: Allow to call with a callback fn instead
        console.warn("Subscribe was called outside a reactive context.");
      }

      if (sub.isOutdated) {
        const value = computeSubscriberValue(sub, ...args);
        return formatSubscriptionValue(value);
      }

      return formatSubscriptionValue(sub.value);
    },
    __subscriberId: subscriberId, // TODO: Can it be removed?
  }
}

export {
  dispatchEvent,
  registerEffectHandler,
  registerSubscriber,
  registerSideEffect,
  subscribe,
  updateAppState,
};
