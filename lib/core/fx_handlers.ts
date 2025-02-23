import { produce } from "immer";
import { FxHandlerFn, FxHandlerIdentifier } from "../types";
import { executeFx } from "./fxs";
import { libraryState } from "./library_state";
import { updateAppState } from "../fx/update_app_state";

function registerFxHandler(fn: FxHandlerFn): FxHandlerIdentifier {
  const id = Symbol("with-dom-effect-handler");

  libraryState.fxHandlers = produce(libraryState.fxHandlers, (fxHandlers) => {
    fxHandlers.set(id, fn);
  });

  return id;
}

// TODO: How to make it work with type validation?

/**
 * Dispatch an event to be processed by a registered FxHandler.
 *
 * @param id - the ID of the registered FxHandler.
 * @param args - the args to be passed to the FxHandler.
 */
function dispatch(id: FxHandlerIdentifier, ...args: unknown[]): void {
  // TODO: should probably be added to a stack to be ensure that each event
  //       is processed only when the previous one is completely finished
  //       i.e. make sure that the rendering happened too

  // TODO: should this check for infinite loops and prevent them?

  const handler = libraryState.fxHandlers.get(id);

  if (!handler) {
    throw Error("Could not find the effect handler");
  }

  const response = handler(libraryState.appState, ...args);

  const fxIds = Object.getOwnPropertySymbols(response);

  if (fxIds.includes(updateAppState)) {
    executeFx(updateAppState, response[updateAppState]);

    fxIds
      .filter((id) => id !== updateAppState)
      .forEach((fxId) => {
        executeFx(fxId, response[fxId]);
      });
  } else {
    fxIds.forEach((fxId) => {
      executeFx(fxId, response[fxId]);
    });
  }
}

export { dispatch, registerFxHandler };
