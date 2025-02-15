import { Component, options } from "preact";
import { InternalSubscriptionValue } from "./types";

/**
 * Holds the reference to the currently rendered component.
 * This allows us to bind a Subscription to a Component and
 * to keep the latter up to date when the Subscription changes.
 */
let currentComponent: Component<unknown, unknown> | undefined;

interface VNode<P = unknown> extends preact.VNode<P> {
  /** The component instance for this VNode */
  __c: Component<unknown, unknown>;
}

const enum OptionsTypes {
  HOOK = "__h",
  DIFF = "__b",
  DIFFED = "diffed",
  RENDER = "__r",

  CATCH_ERROR = "__e",

  UNMOUNT = "unmount",
}

interface OptionsType {
  [OptionsTypes.HOOK](component: Component, index: number, type: number): void;
  [OptionsTypes.DIFF](vnode: VNode): void;
  [OptionsTypes.DIFFED](vnode: VNode): void;

  [OptionsTypes.RENDER](vnode: VNode): void;
  [OptionsTypes.CATCH_ERROR](error: unknown, vnode: VNode, oldVNode: VNode): void;
  [OptionsTypes.UNMOUNT](vnode: VNode): void;
}

type HookFn<T extends keyof OptionsType> = (
  old: OptionsType[T],
  ...a: Parameters<OptionsType[T]>
) => ReturnType<OptionsType[T]>;


function hook<T extends OptionsTypes>(hookName: T, hookFn: HookFn<T>) {
  // @ts-expect-error private options hooks usage
  options[hookName] = hookFn.bind(null, options[hookName] || (() => {
    // do nothing.
  }));
}

function isWithDomSubscription(object: unknown): object is InternalSubscriptionValue<unknown> {
  if (object == null || typeof object !== "object") {
    return false;
  }

  return (object as InternalSubscriptionValue<unknown>)["__type"] === "with-dom_subscription";
}

function replaceWithDomSubscription(propValue: unknown) {
  return isWithDomSubscription(propValue)
    ? propValue.value + ""
    : propValue;
}

hook(OptionsTypes.DIFF, (old, vnode) => {
  // If it is an HTMLElement (e.g. div, span, p, ...)
  if (typeof vnode.type === "string") {
    const props = vnode.props;

    for (const propName in props) {
      /* eslint-disable  @typescript-eslint/no-explicit-any */
      const propValue: unknown = (props as any)[propName];

      if (propName === "children" && Array.isArray(props[propName])) {
        props[propName] = props[propName].map(replaceWithDomSubscription);
      } else if (isWithDomSubscription(propValue)) {
      /* eslint-disable  @typescript-eslint/no-explicit-any */
        (props as any)[propName] = propValue.value + "";
      }
    }
  }
  old(vnode);
});

hook(OptionsTypes.RENDER, (old, vnode) => {
  currentComponent = vnode.__c;
  old(vnode);
});

hook(OptionsTypes.CATCH_ERROR, (old, error, vnode, oldVNode) => {
  currentComponent = undefined;
  old(error, vnode, oldVNode);
});

hook(OptionsTypes.DIFFED, (old, vnode) => {
  currentComponent = undefined;
  old(vnode);
});

// TODO: Optimize "componentShouldUpdate" hook

export {
  currentComponent
};
