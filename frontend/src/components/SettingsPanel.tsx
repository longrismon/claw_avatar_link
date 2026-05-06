import { useRef, useState } from "react"
import { useStore } from "../store"
import { sendTextInput, sendSettingsUpdate } from "../ws"

const LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "en",   label: "English" },
  { code: "es",   label: "Spanish" },
  { code: "fr",   label: "French" },
  { code: "de",   label: "German" },
  { code: "ja",   label: "Japanese" },
  { code: "zh",   label: "Chinese" },
  { code: "pt",   label: "Portuguese" },
  { code: "ar",   label: "Arabic" },
]

const DEFAULT_AVATAR = "/avatars/hermes-default.glb"

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 6, border: "1px solid #555",
  padding: "6px 8px", background: "#1a1a1e", color: "#fff", fontSize: 13,
}

const btnStyle = (color = "#1d9e75"): React.CSSProperties => ({
  width: "100%", padding: "8px 0", background: color,
  border: "none", borderRadius: 8, color: "#fff",
  cursor: "pointer", fontWeight: 500, marginTop: 8,
})

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const { avatarUrl, setAvatarUrl, language, setLanguage } = useStore()
  const [draftUrl, setDraftUrl] = useState(avatarUrl)
  const [textInput, setTextInput] = useState("")
  const connected = useStore((s) => s.connected)
  const objectUrlRef = useRef<string | null>(null)

  function handleSend() {
    if (!textInput.trim() || !connected) return
    sendTextInput(textInput.trim())
    setTextInput("")
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = URL.createObjectURL(file)
    setAvatarUrl(objectUrlRef.current)
    setDraftUrl(file.name)
  }

  function handleApplyUrl() {
    const url = draftUrl.trim()
    if (!url) return
    // If it looks like a URL (not a filename), apply it directly
    if (url.startsWith("http") || url.startsWith("/")) {
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
      setAvatarUrl(url)
    }
    setOpen(false)
  }

  function handleReset() {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
    setAvatarUrl(DEFAULT_AVATAR)
    setDraftUrl(DEFAULT_AVATAR)
  }

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value
    setLanguage(code)
    sendSettingsUpdate({ language: code })
  }

  function handleClearMemory() {
    sendSettingsUpdate({ clear_memory: true })
  }

  const avatarLabel = avatarUrl.startsWith("blob:")
    ? "Local file"
    : avatarUrl === DEFAULT_AVATAR
    ? "Default"
    : avatarUrl.length > 40
    ? "…" + avatarUrl.slice(-36)
    : avatarUrl

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
          background: "rgba(20,20,24,0.95)", borderRadius: 12, padding: 16,
          backdropFilter: "blur(8px)", color: "#fff", display: "flex",
          flexDirection: "column", gap: 14,
        }}>

          {/* Text input fallback */}
          <div>
            <p style={{ margin: "0 0 6px", fontWeight: 500, fontSize: 13 }}>Text input</p>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleSend}
                disabled={!connected}
                style={{ padding: "6px 12px", background: "#1d9e75", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}
              >
                Send
              </button>
            </div>
          </div>

          {/* Language selector */}
          <div>
            <p style={{ margin: "0 0 6px", fontWeight: 500, fontSize: 13 }}>Language</p>
            <select value={language} onChange={handleLanguageChange} style={inputStyle}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Avatar */}
          <div>
            <p style={{ margin: "0 0 6px", fontWeight: 500, fontSize: 13 }}>
              Avatar &nbsp;<span style={{ fontWeight: 400, color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{avatarLabel}</span>
            </p>

            <input
              value={draftUrl.startsWith("blob:") ? "" : draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://models.readyplayer.me/xxx.glb"
              style={inputStyle}
            />
            <button onClick={handleApplyUrl} style={btnStyle()}>Apply URL</button>

            <label style={{
              display: "block", marginTop: 8, padding: "7px 0", textAlign: "center",
              background: "#2a2a35", border: "1px dashed #666", borderRadius: 8,
              cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.7)",
            }}>
              📂 Upload .glb file
              <input type="file" accept=".glb" onChange={handleFileChange} style={{ display: "none" }} />
            </label>

            <button onClick={handleReset} style={btnStyle("#444")}>Reset to default</button>
          </div>

          {/* Memory */}
          <div>
            <p style={{ margin: "0 0 6px", fontWeight: 500, fontSize: 13 }}>Conversation memory</p>
            <button
              onClick={handleClearMemory}
              disabled={!connected}
              style={btnStyle("#b84040")}
            >
              🗑 Clear memory
            </button>
          </div>

        </div>
      )}
    </>
  )
}
