import { Component, options } from "preact";

const withDomTypeIdentifier = "with-dom_subscription" as const;

/**
 * Holds the reference to the currently rendered component.
 * This allows us to bind a Subscription to a Component and
 * to keep the latter up to date when the Subscription changes.
 */
let currentComponent: Component<any, any> | undefined;

interface VNode<P = any> extends preact.VNode<P> {
  /** The component instance for this VNode */
  __c: Component<any, any>;
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
  [OptionsTypes.CATCH_ERROR](error: any, vnode: VNode, oldVNode: VNode): void;
  [OptionsTypes.UNMOUNT](vnode: VNode): void;
}

type HookFn<T extends keyof OptionsType> = (
  old: OptionsType[T],
  ...a: Parameters<OptionsType[T]>
) => ReturnType<OptionsType[T]>;


function hook<T extends OptionsTypes>(hookName: T, hookFn: HookFn<T>) {
  // @ts-ignore-next-line private options hooks usage
  options[hookName] = hookFn.bind(null, options[hookName] || (() => { }));
}

function isWithDomSubscription(object: any) {
  return typeof object === 'object'
    && object["__type"] === withDomTypeIdentifier;
}

function replaceWithDomSubscription(propValue: any) {
  return isWithDomSubscription(propValue)
    ? propValue.value.value + "" // TODO: value.value or just value?
    : propValue;
}

hook(OptionsTypes.DIFF, (old, vnode) => {
  // If it is an HTMLElement (e.g. div, span, p, ...)
  if (typeof vnode.type === "string") {

    let props = vnode.props;

    for (let propName in props) {
      const propValue = props[propName];

      if (propName === "children" && Array.isArray(propValue)) {
        props[propName] = propValue.map(replaceWithDomSubscription);
      } else {
        props[propName] = replaceWithDomSubscription(propValue);
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
  currentComponent,
  withDomTypeIdentifier,
};
