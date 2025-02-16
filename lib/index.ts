import { dispatch, registerFxHandler } from "./effect_handlers";
import { registerSubscriber, subscribe } from "./subscribers";
import { registerFx } from "./side_effects";
import { enableMapSet } from "immer";
import { registerUpdateAppState, updateAppState } from "./fx/update_app_state";
import { WithDomConfiguration } from "./types";
import { setLibraryState } from "./library_state";

function initialize({
  appState: initialAppState,
  effectHandlers: initialEffectHandlers,
  effects: initialEffects,
  subscribers: initialSubscribers,
}: WithDomConfiguration) {
  enableMapSet();

  setLibraryState({
    appState: initialAppState ?? new Map(),
    effectHandlers: initialEffectHandlers ?? new Map(),
    effects: initialEffects ?? new Map(),
    subscribers: initialSubscribers ?? new Map(),
    subscriberToComponents: new Map(),
  });

  registerUpdateAppState();
}

export {
  dispatch,
  initialize,
  registerFxHandler,
  registerSubscriber,
  registerFx,
  subscribe,

  // fx
  updateAppState,
};
