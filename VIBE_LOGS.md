# DerivFlow: Vibe-Coding Documentation

## The Vision
DerivFlow was conceived as a high-performance, AI-augmented trading dashboard. The goal was to combine Deriv's robust market data with Google Gemini's analytical power, all wrapped in a "Technical Dashboard" aesthetic inspired by professional trading terminals.

## Prompting Journey

### 1. Architecting the Core
**Prompt:** "Build a singleton WebSocket service in TypeScript for the Deriv API. It should handle connection persistence, message queuing before connection, and provide a clean subscription interface for ticks and history."
**Result:** Gemini scaffolded a robust `DerivService` that abstracts away the complexity of raw WebSockets, allowing the UI to simply call `subscribeTicks`.

### 2. Styling the Vibe
**Prompt:** "Design a dark-mode trading dashboard using Tailwind CSS. Use a deep charcoal background (#0A0C10), indigo accents, and glassmorphism for panels. The layout should be information-dense but scannable, similar to a mission control center."
**Result:** The model suggested the "Technical Dashboard" recipe, which I refined with neon glow effects and custom scrollbars to create a premium feel.

### 3. AI-Driven Insights
**Prompt:** "Integrate Gemini 2.0 to analyze real-time market data. Send the last 10 ticks and the current price to the model and ask for a punchy sentiment analysis and a pro trading tip."
**Result:** This created the `AIInsightsPanel`, which transforms raw numbers into actionable intelligence, giving the app its "smart" edge.

### 4. Troubleshooting the Feed
**Prompt:** "The chart is flickering when new ticks arrive. How can I optimize the React state updates for a high-frequency data stream?"
**Result:** Gemini recommended using `useMemo` for chart data transformation and slicing the history array to keep a fixed window of 100 points, ensuring smooth 60fps performance.

## Tech Stack
- **Framework:** React 19 + Vite
- **API:** Deriv WebSocket API
- **AI:** Google Gemini 2.0 (via @google/genai)
- **Styling:** Tailwind CSS 4.0
- **Animations:** Motion (formerly Framer Motion)
- **Charts:** Recharts
- **Icons:** Lucide React

## Final Thoughts
Vibe-coding isn't just about generating code; it's about the dialogue between human intent and machine execution. By treating the AI as a collaborator rather than just a tool, we were able to build a production-ready trading terminal in a single session.
