import { Component } from "preact";

export type WithDomTypeIdentifier = "with-dom_subscription";

export type Identifier = symbol;
export type SubscriberIdentifier = Identifier;
export type SideEffectIdentifier = Identifier;
export type EffectHandlerIdentifier = Identifier;
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
export type SideEffectFn = (...args: any[]) => void;

export type EffectHandlerResponse = Readonly<Record<Identifier, unknown>>;
export type EffectHandlerFn = (
  appState: AppState,
  ...args: unknown[]
) => EffectHandlerResponse;

export interface WithDomConfiguration {
  readonly appState?: AppState;
  readonly effectHandlers?: Map<EffectHandlerIdentifier, EffectHandlerFn>;
  readonly effects?: Map<SideEffectIdentifier, SideEffectFn>;
  readonly subscribers?: Map<
    SubscriberIdentifier,
    Subscriber<unknown, unknown>
  >;
}

type AppState = ReadonlyMap<string | symbol, unknown>;
type EffectHandlers = ReadonlyMap<EffectHandlerIdentifier, EffectHandlerFn>;
type Effects = ReadonlyMap<SideEffectIdentifier, SideEffectFn>;
type Subscribers = ReadonlyMap<
  SubscriberIdentifier,
  Subscriber<unknown, unknown>
>;
export interface LibraryState {
  appState: AppState;
  effectHandlers: EffectHandlers;
  effects: Effects;
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
