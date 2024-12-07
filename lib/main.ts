import { is, List, Map, Set } from "immutable"; // TODO: ImmutableJS weights 65kB (on 66kB...)
import { currentComponent, withDomTypeIdentifier } from "./preact_integration";
import { Component } from "preact";

export type AppState = Map<string | symbol, any>;
export type Identifier = symbol;
export type SubscriberIdentifier = Identifier;
export type SideEffectIdentifier = Identifier;
export type EffectHandlerIdentifier = Identifier;
export interface SubscriptionValue<T> {
  value: T;
}
export type Subscription<T> = {
  __subscriberId: Identifier;
  readonly value: SubscriptionValue<T>;
}

/**
 * Specific to preact
 */
interface InternalSubscriptionValue<T> extends SubscriptionValue<T> {
  type: null;
  __b: number;
  constructor: undefined;
  __type: typeof withDomTypeIdentifier;
}

type SubscriberFn<T, R> = (stateOrDeps: T, ...args: any[]) => R;
type Subscriber<T, R> = {
  id: Identifier;
  dependsOn: List<Identifier>;
  fn: SubscriberFn<T, R>;
  lastValue: any; // TODO: Rename it?
  isOutdated: boolean;
  components: Set<Component>;
};

type SideEffectFn = (...args: any[]) => void;
type SideEffect = {
  id: Identifier;
  fn: SideEffectFn;
};

export type EffectHandlerResponse = {
  [key: Identifier]: any;
};
export type EffectHandlerFn = (appState: AppState, ...args: any[]) => EffectHandlerResponse;

let appState: AppState = Map();
let subscribers = Map<Identifier, Subscriber<any, any>>();
let sideEffects = Map<Identifier, SideEffect>();
let effectHandlers = Map<Identifier, EffectHandlerFn>();
let subscriberToComponents = Map<Identifier, List<Component>>();

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

  subscribers = subscribers.set(id, {
    id: id,
    dependsOn: List.of(...deps),
    fn: realFn,
    lastValue: undefined,
    isOutdated: true,
    components: Set(),
  });

  return id;
}

function registerSideEffect(fn: SideEffectFn): SideEffectIdentifier {
  const id = Symbol("with-dom-side-effect");

  sideEffects = sideEffects.set(id, {
    id: id,
    fn: fn,
  });

  return id;
}

function getSubscriberDirectChildren(
  subscriber: Subscriber<any, any>
): List<Subscriber<any, any>> {
  return subscribers
    .filter(s => s.dependsOn.contains(subscriber.id))
    .toList();
}

function getAllSubscribersChildren(subs: List<Subscriber<any, any>>): List<Subscriber<any, any>> {
  return subs.reduce((acc, el) => {
    const children = getSubscriberDirectChildren(el);

    // TODO: Verify stack overflow
    return acc.push(
      ...children,
      ...getAllSubscribersChildren(children));
  }, List());
}

const updateAppState = registerSideEffect((newState: AppState) => {
  if (is(appState, newState)) {
    console.error(
      "\"updateAppState\" has been called without any modification.\n" +
      "This is a bad smell and could lead to potential performance issues."
    );
  }

  appState = newState;

  const rootSubs = subscribers.filter(s => s.dependsOn.isEmpty());

  let outdatedSubs = List<Subscriber<any, any>>();

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
    if (!is(rootSub.lastValue, newValue)) {
      outdatedSubs = outdatedSubs.push(...getSubscriberDirectChildren(rootSub));

      rootSub.components.forEach(c => c.setState({}));

      subscriberToComponents.get(rootSub.id, List<Component>()).forEach(c => c.setState({}));
    }

    return {
      ...rootSub,
      isOutdated: false,
      lastValue: newValue,
    };
  });

  subscribers = updatedRootSubs.reduce((acc, el) => {
    return acc.set(el.id, el);
  }, subscribers);

  const allOutdatedSubs = outdatedSubs.concat(
    ...getAllSubscribersChildren(outdatedSubs)
  );

  subscribers = allOutdatedSubs.reduce((acc, outdatedSub) => {
    // Notifies all of the related components about the update
    outdatedSub.components.forEach(c => c.setState({}));

    subscriberToComponents.get(outdatedSub.id, List<Component>()).forEach(c => c.setState({}));

    return acc.set(outdatedSub.id, {
      ...outdatedSub,
      isOutdated: true,
      lastValue: undefined,
    });
  }, subscribers);
});

function registerEffectHandler(fn: EffectHandlerFn): EffectHandlerIdentifier {
  const id = Symbol("with-dom-effect-handler");

  effectHandlers = effectHandlers.set(id, fn);

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
function getAllDependencies(subs: List<Subscriber<any, any>>): List<Subscriber<any, any>> {
  return subs.reduce((acc, el) => {
    const parents = el.dependsOn.map(s => {
      const parent = subscribers.get(s);

      if (!parent) {
        throw Error("error");
      }

      return parent;
    });

    return acc.push(...parents, ...getAllDependencies(parents));
  }, List());


  // TODO: Put back this, but working:
  const directDeps = subs
    .flatMap(sub => sub.dependsOn.map(subId => subscribers.get(subId)))
    .filter(sub => !!sub);

  return List([
    ...getAllDependencies(directDeps),
    ...directDeps,
  ]);
}

function computeAllDependenciesValues(
  subscriber: Subscriber<any, any>,
  ...args: any[]
): typeof subscribers {
  const allParents = getAllDependencies(List.of(subscriber));

  return allParents
    .reverse()
    .reduce((subscribers, sub) => {

      if (!sub.isOutdated) {
        return subscribers;
      }

      if (sub.dependsOn.isEmpty()) {
        return subscribers.set(sub.id, {
          ...sub,
          lastValue: sub.fn(appState, ...args),
          isOutdated: false,
        });
      }

      const parents = sub.dependsOn.map(id => subscribers.get(id));

      // TODO: Remove
      if (!parents.every(el => !!el)) {
        throw Error("One parent was not found");
      }

      // TODO: Remove
      if (!parents.every(el => !el?.isOutdated)) {
        throw Error("One of the parent is outdated...");
      }

      return subscribers.set(sub.id, {
        ...sub,
        lastValue: sub.fn(parents.map(el => el?.lastValue)), // TODO: There is something wrong with args
        isOutdated: false,
      });
    }, subscribers);
}

function computeSubscriberValue(subscriber: Subscriber<any, any>, ...args: any[]): any {
  const updatedDeps = computeAllDependenciesValues(subscriber); // TODO: args

  const directDeps = subscriber.dependsOn.map(id => updatedDeps.get(id));

  // TODO: Remove
  if (!directDeps.every(el => !el?.isOutdated)) {
    throw Error("One of the parent is outdated...");
  }

  const state = directDeps.isEmpty()
    ? appState
    : directDeps.map(el => el?.lastValue);

  const value = subscriber.fn(state, ...args);

  subscribers = updatedDeps.set(subscriber.id, {
    ...subscriber,
    lastValue: value,
    isOutdated: false,
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
): Subscription<T> {
  return {
    get value(): InternalSubscriptionValue<T> {
      const sub = subscribers.get(this.__subscriberId);

      if (!sub) {
        throw Error("Could not find the related Subscriber");
      }

      if (currentComponent) {
        // TODO: Is erased
        subscribers = subscribers.update(this.__subscriberId, sub => ({
          ...sub,
          components: sub!.components.add(currentComponent!),
        } as Subscriber<any, any>));

        subscriberToComponents = subscriberToComponents.update(this.__subscriberId, x => {
          return (x ?? List()).push(currentComponent!);
        });

      } else {
        console.warn("Subscribe was called outside a reactive context.");
      }

      if (sub.isOutdated) {
        const value = computeSubscriberValue(sub, ...args);
        return formatSubscriptionValue(value);
      }

      return formatSubscriptionValue(sub.lastValue);
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
