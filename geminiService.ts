
import { GoogleGenAI } from "@google/genai";

// Fixed: Always use direct access to process.env.API_KEY as per Google GenAI guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProductDescription = async (productName: string, category: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere uma descrição de marketing curta e atraente em português para o produto "${productName}" na categoria "${category}". Use no máximo 200 caracteres.`,
    });
    // Fixed: Accessed .text property directly (not a method) as per guidelines
    return response.text || "Descrição não pôde ser gerada.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a IA.";
  }
};
