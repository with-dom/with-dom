import { dispatch, registerFxHandler } from "./core/fx_handlers.ts";
import { registerSubscriber, subscribe } from "./core/subscribers";
import { registerFx } from "./core/fxs";
import { enableMapSet } from "immer";
import { registerUpdateAppState, updateAppState } from "./fx/update_app_state";
import { WithDomConfiguration } from "./types";
import { setLibraryState } from "./core/library_state";

/**
 * Initialize the library state.
 *
 * @remarks it is required to call this *before* anything else of the library.
 */
function initialize({
  appState: initialAppState,
  effectHandlers: initialEffectHandlers,
  effects: initialEffects,
  subscribers: initialSubscribers,
}: WithDomConfiguration) {
  enableMapSet();

  setLibraryState({
    appState: initialAppState ?? new Map(),
    fxHandlers: initialEffectHandlers ?? new Map(),
    fxs: initialEffects ?? new Map(),
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
