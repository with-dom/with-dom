import { produce } from "immer";
import { FxFn, FxIdentifier } from "../types";
import { libraryState } from "./library_state";

/**
 * Register an Fx with a *specific* identifier. This should only be used for
 * Fx shared between multiple projects.
 *
 * @param id - the ID of the Fx
 * @param fn - the Fx function (impure, no return)
 */
function registerCoreFx(id: FxIdentifier, fn: FxFn): void {
  libraryState.fxs = produce(libraryState.fxs, (effects) => {
    effects.set(id, fn);
  });
}

/**
 * Register an Fx and returns its ID to be used later.
 *
 * @remarks the IDs are unique, it is not possible to override an Fx.
 *
 * @param fn - the Fx function (impure, no return)
 */
function registerFx(fn: FxFn): FxIdentifier {
  const id = Symbol("with-dom-side-effect");

  libraryState.fxs = produce(libraryState.fxs, (effects) => {
    effects.set(id, fn);
  });

  return id;
}

// TODO: How to make it work with type validation?
// TODO: Make it work with async side effects

/**
 * Execute an Fx.
 *
 * @param id - the ID of the Fx to execute
 * @param args - the args to pass to the Fx function
 */
function executeFx(id: FxIdentifier, ...args: unknown[]): void {
  const sideEffectFn = libraryState.fxs.get(id);

  if (!sideEffectFn) {
    throw Error(`Could not find the side-effect`);
  }

  sideEffectFn(...args);
}

export { executeFx, registerCoreFx, registerFx };
