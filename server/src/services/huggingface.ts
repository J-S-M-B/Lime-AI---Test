import { InferenceClient } from '@huggingface/inference';

interface HuggingFaceError extends Error {
  response?: {
    status: number;
    data: any;
  };
}

class HuggingFaceService {
  private client: InferenceClient;
  private model: string;
  private apiKey: string;

  constructor() {
    this.apiKey = String(process.env.HUGGINGFACE_API_KEY);
    this.model = String(process.env.HF_MODEL);
    this.client = new InferenceClient(this.apiKey);
  }

  async generateText(prompt: string): Promise<string> {
    try {
      console.log(`[HF] Calling model: ${this.model}`);
      console.log(`[HF] Prompt: ${prompt.substring(0, 50)}...`);

      const response = await this.client.chatCompletion({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        parameters: {
          max_tokens: 5000,
          temperature: 0.1,
          top_p: 0.9,
          repetition_penalty: 1.1
        }
      });

      const generatedText = response.choices[0]?.message?.content?.trim() || '';
      console.log(`[HF] Response: ${generatedText.substring(0, 100)}...`);
      return generatedText;

    } catch (error: unknown) {
      const err = error as HuggingFaceError;
      console.error('[HF] InferenceClient error:', err.message);
      console.log('[HF] Falling back to direct fetch...');
      return await this.generateTextWithFetch(prompt);
    }
  }

  private async generateTextWithFetch(prompt: string): Promise<string> {
    try {
      console.log(`[HF] Using direct fetch for: ${this.model}`);
      
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${this.model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 512,
              temperature: 0.1,
              top_p: 0.9,
              return_full_text: false
            }
          })
        }
      );

      console.log('[HF] Fetch status:', response.status);

      if (response.status === 503) {
        const errorData = await response.json();
        console.log(`[HF] Model loading, wait: ${errorData.estimated_time}s`);
        await new Promise(resolve => setTimeout(resolve, errorData.estimated_time * 1000 + 2000));
        return await this.generateTextWithFetch(prompt);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return this.extractGeneratedText(data);

    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HF] Fetch error:', err.message);
      throw err;
    }
  }

  private extractGeneratedText(data: any): string {
    if (Array.isArray(data)) {
      if (data[0]?.generated_text) return data[0].generated_text;
      if (data[0]?.translation_text) return data[0].translation_text;
      if (data[0]?.summary_text) return data[0].summary_text;
    }
    
    if (data.generated_text) return data.generated_text;
    if (data.translation_text) return data.translation_text;
    
    return JSON.stringify(data);
  }

  async extractOasisData(transcript: string): Promise<any> {
    const shortTranscript = transcript.length > 1000 
      ? transcript.substring(0, 1000) + '...' 
      : transcript;

    const prompt = `Extrae datos OASIS Sección G en formato JSON: ${shortTranscript}

Retrieve JSON ONLY with this format:
{
  "M1800": {"value": "0|1|2|3|unknown", "evidence": "texto relevante"},
  "M1810": {"value": "0|1|2|3|unknown", "evidence": "texto relevante"},
  "M1820": {"value": "0|1|2|3|unknown", "evidence": "texto relevante"},
  "M1830": {"value": "0|1|2|3|4|5|6|unknown", "evidence": "texto relevante"},
  "M1840": {"value": "0|1|2|3|4|unknown", "evidence": "texto relevante"},
  "M1850": {"value": "0|1|2|3|4|5|unknown", "evidence": "texto relevante"},
  "M1860": {"value": "0|1|2|3|4|5|6|unknown", "evidence": "texto relevante"},
  "confidence": 0.9
}`;

    try {
      const response = await this.generateText(prompt);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON found in response');
      } catch (parseError: unknown) {
        const err = parseError as Error;
        console.error('[HF] JSON parse error:', err.message);
        console.log('[HF] Raw response:', response);
        throw new Error('Failed to parse OASIS data from response');
      }

    } catch (error: unknown) {
      const err = error as Error;
      console.error('[HF] OASIS extraction error:', err.message);
      throw err;
    }
  }
}
export { HuggingFaceService };

export const huggingFaceService = new HuggingFaceService();

export default huggingFaceService;