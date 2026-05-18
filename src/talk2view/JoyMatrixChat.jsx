import { useState } from "react";
import { Talk2View, ChatWidget } from "@talk2view/sdk/ui";

const PARTNER_KEY = "pk_live_50f4feb3bda0eb5b3a1c4b5faea0a567e8cd984608d989d0";

const SUGGESTIONS = [
  "How does the algorithm decide who gets what?",
  "Which person is at burnout risk?",
  "What do the four quadrants mean?",
];

export default function JoyMatrixChat() {
  const [showCallout, setShowCallout] = useState(true);
  const dismiss = () => setShowCallout(false);
  return (
    <Talk2View partnerKey={PARTNER_KEY}>
      <div onClick={dismiss}>
        <ChatWidget welcome={{ heading: "Ask The Joy Matrix", suggestions: SUGGESTIONS }} />
      </div>
      {showCallout && <Callout onDismiss={dismiss} />}
    </Talk2View>
  );
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
      Try Talk2View <span style={{ display: "inline-block", animation: "jm-wave 2.5s ease-in-out infinite", transformOrigin: "70% 70%" }}>👋</span>
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
