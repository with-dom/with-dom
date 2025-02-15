import { Immutable } from "immer";
import { Component } from "preact";

export type WithDomTypeIdentifier = "with-dom_subscription"

export type AppState = Immutable<Map<string | symbol, unknown>>;
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
  readonly components: Set<Component>;
}

// TODO: remove the any
/* eslint-disable  @typescript-eslint/no-explicit-any */
export type SideEffectFn = (...args: any[]) => void;
export interface SideEffect {
  readonly id: Identifier;
  readonly fn: SideEffectFn;
}

export type EffectHandlerResponse = Readonly<Record<Identifier, unknown>>;
export type EffectHandlerFn = (appState: AppState, ...args: unknown[]) => EffectHandlerResponse;

/**
 * Specific to preact
 */
export interface InternalSubscriptionValue<T> extends SubscriptionValue<T> {
  readonly type: null;
  readonly __b: number;
  readonly constructor: undefined;
  readonly __type: WithDomTypeIdentifier;
}
