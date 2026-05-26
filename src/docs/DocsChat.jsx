// The Talk2View assistant on the documentation site. It mounts the very same
// JoyMatrixChat the app uses, wired to the shared localStorage project — so a
// reader can ask both conceptual questions ("what do the four quadrants mean?")
// and questions about their own project ("who's at burnout risk?"), and any
// changes or theme switches persist and show up when they return to the app.
//
// This is possible because the chat's tools now depend on src/state.js rather
// than App.jsx, so mounting the full chat here doesn't pull the app into the
// docs bundle. The only tool that's inert here is switch_tab — the docs page
// has no tabs — so it's wired to a no-op.

import { useMemo, useState } from "react";
import JoyMatrixChat from "../talk2view/JoyMatrixChat";
import { useTheme } from "../ui/theme.jsx";
import { loadState, saveState, computeAssignments, DEMO_STATE, EMPTY_STATE } from "../state.js";

export default function DocsChat() {
  const { setTheme } = useTheme();
  // Read the existing project if there is one; otherwise show the demo to the
  // chat in memory. We deliberately don't persist on mount — merely reading the
  // docs shouldn't write a project — only explicit chat actions save.
  const [state, setState] = useState(() => loadState() ?? structuredClone(DEMO_STATE));
  const commit = (next) => { saveState(next); return next; };
  const update = (fn) => setState((s) => commit(fn(structuredClone(s))));
  const { assignments, summary } = useMemo(() => computeAssignments(state), [state]);

  return (
    <JoyMatrixChat
      state={state}
      summary={summary}
      assignments={assignments}
      update={update}
      setTab={() => {}}
      setTheme={setTheme}
      loadDemo={() => setState(commit(structuredClone(DEMO_STATE)))}
      clearProject={() => setState(commit(structuredClone(EMPTY_STATE)))}
    />
  );
}
