import AvatarScene from "./components/AvatarScene"
import ChatOverlay from "./components/ChatOverlay"
import VoiceIO from "./components/VoiceIO"
import SettingsPanel from "./components/SettingsPanel"

export default function App() {
  return (
    <div style={{
      width: "100vw", height: "100vh", position: "relative",
      background: "linear-gradient(160deg, #0f1117 0%, #1a2535 100%)",
    }}>
      <AvatarScene />
      <ChatOverlay />
      <SettingsPanel />
      <div style={{
        position: "absolute", bottom: 32, left: "50%",
        transform: "translateX(-50%)", display: "flex",
        flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        <VoiceIO />
      </div>
    </div>
  )
}
