import { useStore, EmotionName } from "../store"

const EMOJI: Record<EmotionName, string> = {
  neutral:   "😐",
  happy:     "😊",
  sad:       "😔",
  surprised: "😮",
  angry:     "😠",
  thinking:  "🤔",
}

export default function EmotionBadge() {
  const emotion = useStore((s) => s.currentEmotion)
  if (emotion === "neutral") return null

  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      background: "rgba(20,20,24,0.75)", backdropFilter: "blur(4px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 20, padding: "4px 10px",
      display: "flex", alignItems: "center", gap: 5,
      color: "#fff", fontSize: 12, pointerEvents: "none",
      transition: "opacity 0.3s",
    }}>
      <span style={{ fontSize: 15 }}>{EMOJI[emotion]}</span>
      <span style={{ opacity: 0.7, textTransform: "capitalize" }}>{emotion}</span>
    </div>
  )
}
