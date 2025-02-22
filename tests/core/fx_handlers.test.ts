import { expect, suite, test, vi } from "vitest";
import { dispatch, registerFxHandler } from "../../lib/core/fx_handlers";
import { registerCoreFx, registerFx } from "../../lib/core/fxs";
import { libraryState } from "../../lib/core/library_state";
import { updateAppState } from "../../lib/fx/update_app_state";

test("registerFxHandler registers an effect handler", () => {
  expect(libraryState.fxHandlers.size).toBe(0);

  const handler = (_: unknown) => ({});

  const handlerId = registerFxHandler(handler);

  expect(libraryState.fxHandlers.size).toBe(1);
  expect(libraryState.fxHandlers.get(handlerId)).toBe(handler);
});

suite("dispatch executes correctly all the fx", () => {
  test("when one fx is defined in the handler", () => {
    const calledWith = new Map();

    const spyFn = vi.fn((_) => {});

    const fxId = registerFx(spyFn);

    const handlerId = registerFxHandler((_state) => {
      return { [fxId]: calledWith };
    });

    dispatch(handlerId);

    expect(spyFn).toHaveBeenCalledExactlyOnceWith(calledWith);
  });

  test("when multiple fx are defined in the handler", () => {
    const calledWith1 = new Map();
    const calledWith2 = false;

    const spyFn1 = vi.fn((_) => {});
    const spyFn2 = vi.fn((_) => {});

    const fxId1 = registerFx(spyFn1);
    const fxId2 = registerFx(spyFn2);

    const handlerId = registerFxHandler((_state) => {
      return {
        [fxId1]: calledWith1,
        [fxId2]: calledWith2,
      };
    });

    dispatch(handlerId);

    expect(spyFn1).toHaveBeenCalledExactlyOnceWith(calledWith1);
    expect(spyFn2).toHaveBeenCalledExactlyOnceWith(calledWith2);
  });

  test("starting with updateAppState if present", () => {
    const calledWith1 = new Map();
    const calledWith2 = false;

    const spyFn1 = vi.fn((_) => {});
    const spyFn2 = vi.fn((_) => {});
    const spyUpdateAppState = vi.fn((_) => {});

    const fxId1 = registerFx(spyFn1);
    const fxId2 = registerFx(spyFn2);

    registerCoreFx(updateAppState, spyUpdateAppState);

    const handlerId = registerFxHandler((_state) => {
      return {
        [fxId1]: calledWith1,
        [fxId2]: calledWith2,
        [updateAppState]: _state,
      };
    });

    dispatch(handlerId);

    expect(spyUpdateAppState).toHaveBeenCalledBefore(spyFn1);
    expect(spyUpdateAppState).toHaveBeenCalledBefore(spyFn2);
  });
});
