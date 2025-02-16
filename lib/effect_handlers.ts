import { produce } from "immer";
import { EffectHandlerFn, EffectHandlerIdentifier } from "./types";
import { executeFx } from "./side_effects";
import { libraryState } from "./library_state";

function registerFxHandler(fn: EffectHandlerFn): EffectHandlerIdentifier {
  const id = Symbol("with-dom-effect-handler");

  libraryState.effectHandlers = produce(libraryState.effectHandlers, (effectHandlers) => {
    effectHandlers.set(id, fn);
  });

  return id;
}

// TODO: How to make it work with type validation?
function dispatch(id: EffectHandlerIdentifier, ...args: unknown[]): void {
  // TODO: should probably be added to a stack to be ensure that each event 
  //       is processed only when the previous one is completely finished
  //       i.e. make sure that the rendering happened too

  const handler = libraryState.effectHandlers.get(id);

  if (!handler) {
    throw Error("Could not find the effect handler");
  }

  const response = handler(libraryState.appState, ...args);

  // TODO: We should ensure that the first fx to be executed is always
  //       updateAppState (and that the new state is then used for all others fx)
  Object.getOwnPropertySymbols(response).forEach((effectId) => {
    executeFx(effectId, response[effectId]);
  });
}

export {
  dispatch,
  registerFxHandler,
};
