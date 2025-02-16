import { LibraryState } from "./types";

let libraryState: LibraryState;

function setLibraryState(value: typeof libraryState) {
  libraryState = value;
}

export { libraryState, setLibraryState };
