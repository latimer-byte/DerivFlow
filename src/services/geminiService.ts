import { GoogleGenAI } from "@google/genai";

let aiInstance: any = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function getMarketInsights(symbol: string, currentPrice: number, history: any[]) {
  try {
    const ai = getAI();
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
    return "AI insights are currently unavailable. Please configure your GEMINI_API_KEY.";
  }
}
