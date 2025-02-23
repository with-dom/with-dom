import { Component } from "preact";

export type WithDomTypeIdentifier = "with-dom_subscription";

export type Identifier = symbol;
export type SubscriberIdentifier = Identifier;
export type FxIdentifier = Identifier;
export type FxHandlerIdentifier = Identifier;
export interface SubscriptionValue<T> {
  readonly value: T;
}

export type SubscriberFn<T, R> = (stateOrDeps: T, ...args: unknown[]) => R;
export interface Subscriber<T, R> {
  readonly id: Identifier;
  readonly dependsOn: SubscriberIdentifier[];
  readonly fn: SubscriberFn<T, R>;
  readonly value: unknown;
  readonly isOutdated: boolean;
  // readonly components: Set<Component>; TODO: Ideally, this should replace "subscriberToComponents"
}

// TODO: remove the any
/* eslint-disable  @typescript-eslint/no-explicit-any */
export type FxFn = (...args: any[]) => void;

export type FxHandlerResponse = Readonly<Record<Identifier, unknown>>;
export type FxHandlerFn = (
  appState: AppState,
  ...args: unknown[]
) => FxHandlerResponse;

export interface WithDomConfiguration {
  readonly appState?: AppState;
  readonly effectHandlers?: Map<FxHandlerIdentifier, FxHandlerFn>;
  readonly effects?: Map<FxIdentifier, FxFn>;
  readonly subscribers?: Map<
    SubscriberIdentifier,
    Subscriber<unknown, unknown>
  >;
}

type AppState = ReadonlyMap<string | symbol, unknown>;
type FxHandlers = ReadonlyMap<FxHandlerIdentifier, FxHandlerFn>;
type Fxs = ReadonlyMap<FxIdentifier, FxFn>;
type Subscribers = ReadonlyMap<
  SubscriberIdentifier,
  Subscriber<unknown, unknown>
>;

/**
 * References all of the internal state variables of the library.
 */
export interface LibraryState {
  appState: AppState;
  fxHandlers: FxHandlers;
  fxs: Fxs;
  subscribers: Subscribers;
  subscriberToComponents: ReadonlyMap<SubscriberIdentifier, Component[]>;
}

/**
 * Specific to preact
 */
export interface InternalSubscriptionValue<T> extends SubscriptionValue<T> {
  readonly type: null;
  readonly __b: number;
  readonly constructor: undefined;
  readonly __type: WithDomTypeIdentifier;
}
