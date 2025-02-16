import { produce } from "immer";
import { SideEffectFn, SideEffectIdentifier } from "./types";
import { libraryState } from "./library_state";

function registerCoreFx(id: SideEffectIdentifier, fn: SideEffectFn): void {
  libraryState.effects = produce(libraryState.effects, (effects) => {
    effects.set(id, fn);
  });
}

function registerFx(fn: SideEffectFn): SideEffectIdentifier {
  const id = Symbol("with-dom-side-effect");

  libraryState.effects = produce(libraryState.effects, (effects) => {
    effects.set(id, fn);
  });

  return id;
}

// TODO: How to make it work with type validation?
// TODO: Make it work with async side effects
function executeFx(id: SideEffectIdentifier, ...args: unknown[]): void {
  const sideEffectFn = libraryState.effects.get(id);

  if (!sideEffectFn) {
    throw Error(`Could not find the side-effect`);
  }

  sideEffectFn(...args);
}

export {
  executeFx,
  registerCoreFx,
  registerFx,
};
