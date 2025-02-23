import { assert, expect, test, vi } from "vitest";
import { executeFx, registerCoreFx, registerFx } from "../../lib/core/fxs";
import { libraryState } from "../../lib/core/library_state";

test("registerCoreFx registers a core fx", () => {
  const initialFxSize = libraryState.fxs.size;

  const fxId = Symbol();
  const fxFn = () => {};

  registerCoreFx(fxId, fxFn);

  expect(libraryState.fxs.size).toBe(initialFxSize + 1);
  expect(libraryState.fxs.get(fxId)).toBe(fxFn);
});

test("registerFx registers an fx", () => {
  const initialFxSize = libraryState.fxs.size;

  const fxFn = () => {};

  const fxId = registerFx(fxFn);

  expect(libraryState.fxs.size).toBe(initialFxSize + 1);
  expect(libraryState.fxs.get(fxId)).toBe(fxFn);
});

test("executeFx throws if the fx is not found", () => {
  assert.throws(() => executeFx(Symbol()));
});

test("executeFx executes an fx without params", () => {
  const spyFn = vi.fn(() => {});
  const fxId = registerFx(spyFn);

  expect(spyFn).not.toHaveBeenCalled();

  executeFx(fxId);

  expect(spyFn).toHaveBeenCalledExactlyOnceWith();
});

test("executeFx executes an fx with params", () => {
  const spyFn = vi.fn((_one, _two) => {});
  const fxId = registerFx(spyFn);

  expect(spyFn).not.toHaveBeenCalled();

  executeFx(fxId, 1, 2);

  expect(spyFn).toHaveBeenCalledExactlyOnceWith(1, 2);
});
