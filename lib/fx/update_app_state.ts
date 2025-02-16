import { castDraft, produce } from "immer";
import { registerCoreFx } from "../side_effects";
import { getAllSubscribersChildren, getRootSubscribers, getSubscriberDirectChildren, updateSubscribers } from "../subscribers";
import { Subscriber } from "../types";
import { areEquivalent } from "../are_equivalent";
import { libraryState } from "../library_state";

const identifier = Symbol.for("with-dom/fx/updateAppState");

const registerUpdateAppState = () => {
  registerCoreFx(identifier, (newState: typeof libraryState.appState) => {
    // TODO: is it worth to use areEquivalent here?
    if (libraryState.appState === newState) {
      console.error(
        "\"updateAppState\" has been called without any modification.\n" +
        "This is a bad smell and could lead to potential performance issues."
      );
    }

    const rootSubs = getRootSubscribers();

    let outdatedSubs: Subscriber<unknown, unknown>[] = [];

    /**
     * Every time the appState is updated, we compute all of the subscribers
     * that have no dependencies (i.e. the root subs).
     */
    // TODO: Optimize by computing only the root subs that have some subscribers
    //       in their tree
    const updatedRootSubs = rootSubs.map(rootSub => {
      const newValue = rootSub.fn(newState);

      if (!areEquivalent(rootSub.value, newValue)) {
        outdatedSubs = produce(outdatedSubs, (outdatedSubs) => {
          outdatedSubs.push(...castDraft(getSubscriberDirectChildren(rootSub)));
        });

        if (libraryState.subscriberToComponents.has(rootSub.id)) {
          libraryState.subscriberToComponents.get(rootSub.id)?.forEach(c => c.setState({}));
        }
      }

      return {
        ...rootSub,
        isOutdated: false,
        value: newValue,
      };
    });

    updateSubscribers(subscribers => {
      updatedRootSubs.forEach(el => {
        subscribers.set(el.id, castDraft(el));
      });
    });

    const allOutdatedSubs = outdatedSubs.concat(
      ...getAllSubscribersChildren(outdatedSubs)
    );

    updateSubscribers(subscribers => {
      allOutdatedSubs.forEach(outdatedSub => {
        if (libraryState.subscriberToComponents.has(outdatedSub.id)) {
          libraryState.subscriberToComponents.get(outdatedSub.id)?.forEach(c => c.setState({}));
        }

        subscribers.set(outdatedSub.id, castDraft({
          ...outdatedSub,
          isOutdated: true,
          value: undefined,
        }));
      });
    });

    libraryState.appState = newState;
  })
}

export {
  registerUpdateAppState,
  identifier as updateAppState,
};
