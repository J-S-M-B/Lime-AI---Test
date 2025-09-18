import { huggingFaceService } from './huggingface';

export class LLMService {
  async extractOasisData(transcript: string): Promise<any> {
    try {
      console.log('[LLM] Using Hugging Face API for OASIS extraction');
      return await huggingFaceService.extractOasisData(transcript);
    } catch (error) {
      console.error('[LLM] Hugging Face extraction failed:', error);
      throw error;
    }
  }
}

export const llmService = new LLMService();