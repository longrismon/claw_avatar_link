import { useState } from "react"
import { useStore } from "../store"
import { sendTextInput } from "../ws"

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const { avatarUrl, setAvatarUrl } = useStore()
  const [draftUrl, setDraftUrl] = useState(avatarUrl)
  const [textInput, setTextInput] = useState("")
  const connected = useStore((s) => s.connected)

  function handleSend() {
    if (!textInput.trim() || !connected) return
    sendTextInput(textInput.trim())
    setTextInput("")
  }

  return (
    <>
      <button onClick={() => setOpen(!open)} style={{
        position: "absolute", top: 16, right: 16,
        background: "rgba(255,255,255,0.15)", border: "none",
        borderRadius: 8, padding: "6px 12px", color: "#fff",
        backdropFilter: "blur(4px)", cursor: "pointer", fontSize: 13,
      }}>
        ⚙ Settings
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 56, right: 16, width: 320,
          background: "rgba(20,20,24,0.92)", borderRadius: 12, padding: 16,
          backdropFilter: "blur(8px)", color: "#fff",
        }}>
          <p style={{ margin: "0 0 8px", fontWeight: 500 }}>Text input (fallback)</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message…"
              style={{
                flex: 1, borderRadius: 6, border: "1px solid #555",
                padding: "6px 8px", background: "#1a1a1e", color: "#fff", fontSize: 13,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!connected}
              style={{
                padding: "6px 12px", background: "#1d9e75", border: "none",
                borderRadius: 6, color: "#fff", cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>

          <p style={{ margin: "0 0 8px", fontWeight: 500 }}>Avatar URL</p>
          <input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://models.readyplayer.me/xxx.glb"
            style={{
              width: "100%", borderRadius: 6, border: "1px solid #555",
              padding: "6px 8px", background: "#1a1a1e", color: "#fff", fontSize: 13,
            }}
          />
          <button
            onClick={() => { setAvatarUrl(draftUrl); setOpen(false) }}
            style={{
              marginTop: 10, width: "100%", padding: "8px 0",
              background: "#1d9e75", border: "none", borderRadius: 8,
              color: "#fff", cursor: "pointer", fontWeight: 500,
            }}
          >
            Apply
          </button>
        </div>
      )}
    </>
  )
}
