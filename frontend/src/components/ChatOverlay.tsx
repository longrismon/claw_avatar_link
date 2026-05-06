import { useEffect, useRef } from "react"
import { useStore } from "../store"

export default function ChatOverlay() {
  const messages = useStore((s) => s.messages)
  const thinking = useStore((s) => s.agentThinking)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  return (
    <>
      <style>{`
        @keyframes thinking-dot {
          0%, 80%, 100% { opacity: 0.2 }
          40% { opacity: 1 }
        }
        .thinking-dot { display: inline-block; animation: thinking-dot 1.4s infinite; }
        .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <div style={{
        position: "absolute", bottom: 120, left: 20, right: 20,
        maxHeight: 240, overflowY: "auto", display: "flex",
        flexDirection: "column", gap: 8, pointerEvents: "none",
        scrollbarWidth: "none",
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            background: m.role === "user" ? "rgba(30,158,117,0.85)" : "rgba(255,255,255,0.9)",
            color: m.role === "user" ? "#fff" : "#111",
            borderRadius: 12, padding: "6px 12px",
            fontSize: 14, maxWidth: "75%", backdropFilter: "blur(4px)",
          }}>
            {m.text}
          </div>
        ))}

        {thinking && (
          <div style={{
            alignSelf: "flex-start", background: "rgba(255,255,255,0.7)",
            borderRadius: 12, padding: "6px 14px", fontSize: 18, color: "#555",
          }}>
            <span className="thinking-dot">•</span>
            <span className="thinking-dot">•</span>
            <span className="thinking-dot">•</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </>
  )
}
