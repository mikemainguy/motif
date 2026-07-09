import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

let embedder: FeatureExtractionPipeline | null = null;

export async function initEmbedder(): Promise<void> {
  if (embedder) return;
  console.log('Loading embedding model (Xenova/all-MiniLM-L6-v2)...');
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as FeatureExtractionPipeline;
  console.log('Embedding model loaded');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedder) await initEmbedder();
  const result = await embedder!(text, { pooling: 'mean', normalize: true } as Record<string, unknown>);
  return Array.from((result as unknown as { data: Float32Array }).data);
}

export async function generateEmbeddings(
  texts: string[],
  batchSize = 50
): Promise<number[][]> {
  if (!embedder) await initEmbedder();

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const results = await embedder!(batch as unknown as string, { pooling: 'mean', normalize: true } as Record<string, unknown>);

    const dims = 384;
    const data = (results as unknown as { data: Float32Array }).data;
    for (let j = 0; j < batch.length; j++) {
      const start = j * dims;
      const embedding = Array.from(data.slice(start, start + dims));
      allEmbeddings.push(embedding);
    }
  }

  return allEmbeddings;
}
