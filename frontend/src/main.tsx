import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { connectWS } from "./ws"
import "./index.css"

connectWS()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
