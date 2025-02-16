import { castDraft, Draft, produce } from "immer";
import {
  InternalSubscriptionValue,
  Subscriber,
  SubscriberFn,
  SubscriberIdentifier,
  SubscriptionValue,
} from "./types";
import { currentComponent } from "./preact_integration";
import { libraryState } from "./library_state";

// TODO: What if "dependsOn" directly held references to subs (and not just ids)?

function registerSubscriber<T>(
  fn: SubscriberFn<typeof libraryState.appState, T>,
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
  const depsSet = new Set(deps);

  if (depsSet.size !== deps.length) {
    throw new Error(
      "A Subscriber can not depend multiple times on the same subscriber",
    );
  }

  libraryState.subscribers = produce(
    libraryState.subscribers,
    (subscribers) => {
      subscribers.set(id, {
        id: id,
        dependsOn: deps,
        fn: realFn,
        value: undefined,
        isOutdated: true,
      });
    },
  );

  return id;
}

function getSubscriberDirectChildren(
  subscriber: Subscriber<unknown, unknown>,
): Subscriber<unknown, unknown>[] {
  return [...libraryState.subscribers.values()].filter((s) =>
    s.dependsOn.includes(subscriber.id),
  );
}

function getAllSubscribersChildren(
  subscribers: Subscriber<unknown, unknown>[],
): Subscriber<unknown, unknown>[] {
  return subscribers.reduce<Subscriber<unknown, unknown>[]>(
    (acc, subscriber) => {
      return produce(acc, (acc) => {
        const directChildren = getSubscriberDirectChildren(subscriber);
        acc.push(...castDraft(directChildren));

        const allChildren = getAllSubscribersChildren(directChildren);
        acc.push(...castDraft(allChildren));
      });
    },
    [],
  );
}

function getRootSubscribers(): Subscriber<unknown, unknown>[] {
  return [...libraryState.subscribers.values()].filter(
    (s) => s.dependsOn.length === 0,
  );
}

function updateSubscribers(
  produceFn: (subs: Draft<typeof libraryState.subscribers>) => void,
) {
  libraryState.subscribers = produce(libraryState.subscribers, produceFn);
}

function getSubscriber(
  id: SubscriberIdentifier,
): Subscriber<unknown, unknown> | undefined {
  return libraryState.subscribers.get(id);
}

/**
 * Retrieves all of the dependencies from the subscribers to the root subscribers.
 * The order of the output matters: from the root of the tree to the leaves
 */
function getAllDependencies(
  subs: Subscriber<unknown, unknown>[],
): Subscriber<unknown, unknown>[] {
  return subs.reduce<Subscriber<unknown, unknown>[]>((acc, el) => {
    const parents = el.dependsOn.map(getSubscriber).filter((s) => !!s);

    return produce(acc, (acc) => {
      acc.push(...castDraft(parents));
      acc.push(...castDraft(getAllDependencies(parents)));
    });
  }, []);
}

function computeAllDependenciesValues(
  subscriber: Subscriber<unknown, unknown>,
  ...args: unknown[]
): typeof libraryState.subscribers {
  const allParents = getAllDependencies([subscriber]);

  return produce(libraryState.subscribers, (subscribers) => {
    [...allParents].reverse().forEach((parent) => {
      if (!parent.isOutdated) {
        return;
      }

      if (parent.dependsOn.length === 0) {
        subscribers.set(parent.id, {
          ...castDraft(parent),
          value: parent.fn(libraryState.appState, ...args),
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
  subscriber: Subscriber<unknown, unknown>,
  ...args: unknown[]
): unknown {
  const updatedDeps = computeAllDependenciesValues(subscriber); // TODO: args

  const directDeps = subscriber.dependsOn.map((id) => updatedDeps.get(id));

  const state =
    directDeps.length === 0
      ? libraryState.appState
      : directDeps.map((el) => el?.value);

  const value = subscriber.fn(state, ...args);

  libraryState.subscribers = produce(
    libraryState.subscribers,
    (subscribers) => {
      updatedDeps.forEach((u) => {
        subscribers.set(u.id, castDraft(u));
      });

      subscribers.set(subscriber.id, {
        ...castDraft(subscriber),
        value: value,
        isOutdated: false,
      });
    },
  );

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
  const sub = getSubscriber(subscriberId);

  if (!sub) {
    throw Error("Could not find the related Subscriber");
  }

  if (currentComponent !== undefined) {
    const draftComponent = castDraft(currentComponent);

    libraryState.subscriberToComponents = produce(
      libraryState.subscriberToComponents,
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
  getAllSubscribersChildren,
  getRootSubscribers,
  getSubscriber,
  getSubscriberDirectChildren,
  registerSubscriber,
  subscribe,
  updateSubscribers,
};
