// The Talk2View assistant for the documentation site. The in-app chat
// (src/talk2view/JoyMatrixChat.jsx) wires up tools that read and mutate a live
// project; the docs page has no project, so this is a read-only variant: same
// partner key, system prompt, and skill, but no tools. It answers questions
// about how the Joy Matrix works. Kept self-contained so the docs bundle
// doesn't pull in the app (JoyMatrixChat → tools.js → App.jsx).

import { useEffect, useRef, useState } from "react";
import { Talk2View, ChatWidget, useTalk2View } from "@talk2view/sdk/ui";
import systemPrompt from "../talk2view/system-prompt.md?raw";
import joyMatrixSkill from "../talk2view/skills/joy-matrix.md?raw";

const PARTNER_KEY = "pk_live_50f4feb3bda0eb5b3a1c4b5faea0a567e8cd984608d989d0";

// Tells the assistant it's on the docs site (no live project / no tools), so it
// answers conceptually instead of offering to act on a project that isn't here.
const DOCS_CONTEXT = `

## Documentation context

You are embedded in the Joy Matrix documentation site, not the app. There is no
live project here and no tools to modify one. Answer questions about how the Joy
Matrix works — the four quadrants, the pleasure/talent/capacity model, the
assignment and scheduling algorithms, the tabs, import/export, and theming. If
someone wants to try it on their own work, point them back to the app at "/".`;

const SUGGESTIONS = [
  "What do the four quadrants mean?",
  "How does auto-assignment work?",
  "What's the difference between capacity and effort?",
];

// Parse YAML-ish frontmatter + body out of a markdown skill file.
function parseSkill(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { name: "", description: "", content: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { name: meta.name || "", description: meta.description || "", content: m[2] };
}

const SKILLS = [parseSkill(joyMatrixSkill)];

export default function DocsChat() {
  const [showCallout, setShowCallout] = useState(true);
  const dismiss = () => setShowCallout(false);
  return (
    <Talk2View partnerKey={PARTNER_KEY} systemPrompt={systemPrompt + DOCS_CONTEXT} tools={[]}>
      <SkillBootstrap />
      <div onClick={dismiss}>
        <ChatWidget welcome={{ heading: "Ask The Joy Matrix", suggestions: SUGGESTIONS }} />
      </div>
      {showCallout && <Callout onDismiss={dismiss} />}
    </Talk2View>
  );
}

// Registers the domain skill with the SDK once per session.
function SkillBootstrap() {
  const { t2v } = useTalk2View();
  const registered = useRef(false);
  useEffect(() => {
    if (!t2v || registered.current) return;
    registered.current = true;
    for (const s of SKILLS) t2v.skills.add(s);
    t2v.skills.register(SKILLS).catch((err) => {
      console.warn("[joy-matrix-docs] skill registration failed:", err);
    });
  }, [t2v]);
  return null;
}

function Callout({ onDismiss }) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: "2rem",
        right: "clamp(5rem, 8vw, 7rem)",
        zIndex: 40,
        background: "#ffffff",
        color: "#1a1a18",
        border: "1px solid #e5e3db",
        borderRadius: 12,
        padding: "10px 14px",
        fontFamily: "var(--joy-font-body, system-ui, sans-serif)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: "0 6px 24px rgba(0,0,0,0.10)",
        animation: "jm-callout-pulse 3s ease-in-out infinite",
      }}
    >
      Ask about the Joy Matrix <span style={{ display: "inline-block", animation: "jm-wave 2.5s ease-in-out infinite", transformOrigin: "70% 70%" }}>👋</span>
      <style>{`
        @keyframes jm-callout-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 6px 24px rgba(0,0,0,0.10); }
          50%      { transform: scale(1.04); box-shadow: 0 6px 28px rgba(58,168,154,0.35); }
        }
        @keyframes jm-wave {
          0%, 100% { transform: rotate(0deg); }
          25%      { transform: rotate(14deg); }
          50%      { transform: rotate(-8deg); }
          75%      { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
}
