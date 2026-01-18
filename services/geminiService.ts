
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Você é o "LexConsul", um assistente de IA especialista em todas as leis brasileiras, contabilidade, gestão de RH e agora também um AUDITOR FISCAL (SEFAZ/SEFA).
Sua expertise abrange:
1. Direito Constitucional (Constituição de 1988).
2. Direito Civil e Processo Civil.
3. Direito do Trabalho (CLT) e Previdenciário.
4. Contabilidade (Normas Brasileiras de Contabilidade - NBC, IFRS) e AUDITORIA TRIBUTÁRIA.
5. Direito Tributário (CTN) e, fundamentalmente, a NOVA REFORMA TRIBUTÁRIA (Emenda Constitucional 132/2023).
6. Gestão de Recursos Humanos (RH) e Relações Trabalhistas.
7. AUDITORIA FISCAL ESTADUAL (SEFA/SEFAZ):
   - Domínio sobre ICMS, IPVA e ITCD.
   - Conhecimento em Substituição Tributária (ST) e Diferencial de Alíquota (DIFAL).
   - Processos de fiscalização, malha fina fiscal e obrigações acessórias (EFD, GIA, NF-e).
   - Prevenção de evasão fiscal e planejamento tributário ético.

Especialidade em Reforma Tributária:
- Domínio total sobre o novo sistema: IVA Dual (IBS e CBS) e Imposto Seletivo.
- Conhecimento sobre os períodos de transição (2024-2033).
- Regras de não cumulatividade plena, desoneração da folha e regimes diferenciados.
- Análise de impactos para empresas (Simples Nacional vs Lucro Real/Presumido).

Regras de conduta:
- Use a ferramenta de pesquisa do Google para verificar atualizações recentes no Diário Oficial, novas leis complementares da Reforma Tributária, portarias da SEFA e jurisprudências (STF/STJ/TIT).
- Sempre cite artigos e leis específicas quando possível.
- Use uma linguagem profissional, porém clara e acessível.
- Informe ao usuário que suas respostas são consultivas e que para casos judiciais ele deve contratar um advogado ou contador devidamente registrado (OAB ou CRC).
- Seja preciso e mantenha-se atualizado com a legislação brasileira vigente.
- Responda sempre em Português do Brasil.
`;

export class GeminiService {
  async chat(message: string, history: { role: 'user' | 'model', parts: { text?: string, inlineData?: { mimeType: string, data: string } }[] }[], imageBase64?: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';
    
    const parts: any[] = [{ text: message }];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      });
    }

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: [
          ...history,
          { role: 'user', parts }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || "Desculpe, não consegui processar uma resposta no momento.";
      
      // Extract sources from grounding metadata if available
      const sources: { uri: string, title: string }[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web && chunk.web.uri) {
            sources.push({
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            });
          }
        });
      }

      return { text, sources: sources.length > 0 ? sources : undefined };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return { text: "Desculpe, ocorreu um erro ao processar sua consulta jurídica. Por favor, tente novamente." };
    }
  }

  async analyzeDocument(data: string, mimeType: string, docType: string, isRawText: boolean = false) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-preview';
    
    const prompt = `Analise detalhadamente este conteúdo do tipo: ${docType}. 
    Se o conteúdo envolver tributos, aplique os conhecimentos da NOVA REFORMA TRIBUTÁRIA e regras de transição, além de normas de AUDITORIA FISCAL.
    1. Identifique os principais pontos e partes envolvidas.
    2. Liste cláusulas ou dados que pareçam irregulares ou que mereçam atenção especial segundo a legislação brasileira.
    3. Sugira melhorias ou próximos passos.
    4. Se for um documento financeiro ou contábil, verifique a consistência dos dados apresentados sob a ótica da fiscalização SEFA.
    Seja técnico, preciso e cite as leis pertinentes (CLT, Código Civil, EC 132/2023, CTN, etc).`;

    const documentPart = isRawText 
      ? { text: `CONTEÚDO PARA ANÁLISE:\n\n${data}` }
      : { inlineData: { mimeType, data } };

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: prompt },
            documentPart
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2,
        }
      });

      return response.text || "Não foi possível extrair uma análise deste conteúdo.";
    } catch (error) {
      console.error("Document Analysis Error:", error);
      return "Erro ao analisar o conteúdo. Verifique os dados e tente novamente.";
    }
  }

  async getSearchSuggestions(query: string, history: string[]) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';
    const prompt = `Você é um motor de busca jurídico e contábil inteligente.
Com base no termo parcial digitado pelo usuário: "${query}"
E no histórico de buscas: [${history.join(', ')}]

TAREFA:
1. Identifique as categorias de especialidade mais prováveis (ex: Trabalhista, Civil, Reforma Tributária, RH, Contábil, Auditor Fiscal).
2. Sugira 5 termos de pesquisa que refinem a busca do usuário.
3. Para cada sugestão, adicione um prefixo contextual curto entre colchetes que indique a área da lei ou contabilidade (ex: [Civil], [Trabalhista], [Reforma], [Auditoria]).
4. Priorize termos que ajudem a encontrar artigos específicos ou mudanças recentes na legislação e normas da SEFA.

Retorne apenas o JSON com as sugestões.`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["suggestions"]
          }
        }
      });

      const data = JSON.parse(response.text || '{"suggestions": []}');
      return data.suggestions as string[];
    } catch (error) {
      console.error("Suggestions Error:", error);
      return [];
    }
  }
}

export const gemini = new GeminiService();
