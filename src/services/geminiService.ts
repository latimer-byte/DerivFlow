import { GoogleGenAI } from "@google/genai";

// Standard way to get API key in Vite/React environment for this platform
const getApiKey = () => {
  try {
    return process.env.GEMINI_API_KEY || "";
  } catch (e) {
    return "";
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function getMarketInsights(symbol: string, currentPrice: number, history: any[]) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "AI insights are currently unavailable. Please configure your GEMINI_API_KEY.";
  }

  try {
    const prompt = `
      You are a professional market analyst. 
      Analyze the current market data for ${symbol}.
      Current Price: ${currentPrice}
      Recent History (last 10 ticks): ${JSON.stringify(history.slice(-10))}
      
      Provide a brief, punchy market sentiment analysis (bullish, bearish, or neutral) and one "pro tip" for a trader.
      Keep it under 100 words. Use a professional yet energetic tone.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The AI is currently contemplating the market. Try again in a moment.";
  }
}

export async function getChatResponse(messages: { role: 'user' | 'model', content: string }[], marketContext?: any) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "AI insights are currently unavailable. Please configure your GEMINI_API_KEY.";
  }

  try {
    const systemPrompt = `
      You are PulseAI, a world-class trading assistant integrated into the TradePulse terminal.
      Your goal is to help traders make informed decisions, explain market concepts, and provide technical analysis.
      
      App Context:
      - Current Market: ${marketContext?.symbol || 'Unknown'}
      - Current Price: ${marketContext?.price || 'Unknown'}
      
      Guidelines:
      - Be concise, professional, and slightly aggressive (in a high-performance trading sense).
      - Use markdown for lists or tables if relevant.
      - NEVER give financial advice, only analysis and educational insights.
    `;

    const chatMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // For simplicity with this SDK version, we use generateContent with the history
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: chatMessages as any,
      config: {
        systemInstruction: systemPrompt
      }
    });

    return response.text || "I'm processing that. One second...";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "The system is currently under heavy load. Please try again shortly.";
  }
}

export async function getMarketSentiment(symbol: string, history: any[]) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const prices = history.slice(-50).map(h => h.quote).join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following price data for ${symbol} and provide a market sentiment analysis.
      Prices (last 50 ticks): ${prices}
      
      Provide the result in valid JSON format ONLY with:
      - score: a number from -100 (bearish) to 100 (bullish)
      - label: "Bullish", "Bearish", or "Neutral"
      - reason: a concise 1-sentence explanation
      - confidence: a percentage (0-100)`,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Sentiment Analysis Error:", error);
    return null;
  }
}
