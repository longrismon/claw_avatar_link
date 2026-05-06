import { create } from "zustand"

export type GestureName = "idle" | "talking" | "wave" | "nod" | "point" | "shrug" | "thinking"

export interface BlendFrame {
  time_ms: number
  weights: Record<string, number>
}

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

interface HermesStore {
  // Connection
  connected: boolean
  setConnected: (v: boolean) => void
  // Conversation
  messages: ChatMessage[]
  appendMessage: (m: ChatMessage) => void
  agentThinking: boolean
  setAgentThinking: (v: boolean) => void
  // Avatar
  currentGesture: GestureName
  setGesture: (g: GestureName) => void
  blendFrames: BlendFrame[]
  setBlendFrames: (f: BlendFrame[]) => void
  // audioStartTime is performance.now() (ms) at the moment TTS playback begins, or null
  audioStartTime: number | null
  setAudioStartTime: (t: number | null) => void
  // Settings
  avatarUrl: string
  setAvatarUrl: (url: string) => void
}

export const useStore = create<HermesStore>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),
  messages: [],
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  agentThinking: false,
  setAgentThinking: (v) => set({ agentThinking: v }),
  currentGesture: "idle",
  setGesture: (g) => set({ currentGesture: g }),
  blendFrames: [],
  setBlendFrames: (f) => set({ blendFrames: f }),
  audioStartTime: null,
  setAudioStartTime: (t) => set({ audioStartTime: t }),
  avatarUrl: "/avatars/hermes-default.glb",
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}))
