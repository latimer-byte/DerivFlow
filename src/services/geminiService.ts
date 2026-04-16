import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMarketInsights(symbol: string, currentPrice: number, history: any[]) {
  if (!process.env.GEMINI_API_KEY) {
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
      model: "gemini-2.0-flash", // Using a fast model for real-time feel
      contents: prompt,
    });

    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The AI is currently contemplating the market. Try again in a moment.";
  }
}
