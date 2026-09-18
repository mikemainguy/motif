/**
 * Text embeddings via the Cloudflare Workers AI REST API.
 *
 * Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. The model is fixed
 * for the lifetime of a database: embeddings are only comparable to other
 * embeddings from the same model, so changing CLOUDFLARE_EMBEDDING_MODEL means
 * re-running `npm run ingest`.
 */

const DEFAULT_MODEL = '@cf/baai/bge-base-en-v1.5';

/** Output dimensions for the Workers AI embedding models. */
const MODEL_DIMENSIONS: Record<string, number> = {
  '@cf/baai/bge-small-en-v1.5': 384,
  '@cf/baai/bge-base-en-v1.5': 768,
  '@cf/baai/bge-large-en-v1.5': 1024,
  '@cf/baai/bge-m3': 1024,
};

const MAX_RETRIES = 4;
const RETRY_BASE_MS = 500;

export function getEmbeddingModel(): string {
  return process.env.CLOUDFLARE_EMBEDDING_MODEL || DEFAULT_MODEL;
}

export function getEmbeddingDimensions(): number {
  const model = getEmbeddingModel();
  const known = MODEL_DIMENSIONS[model];
  if (known) return known;

  const override = process.env.CLOUDFLARE_EMBEDDING_DIMENSIONS;
  if (override) {
    const parsed = Number.parseInt(override, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  throw new Error(
    `Unknown embedding dimensions for model "${model}". ` +
      `Set CLOUDFLARE_EMBEDDING_DIMENSIONS to its output size.`
  );
}

function getCredentials(): { accountId: string; apiToken: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    const missing = [
      !accountId && 'CLOUDFLARE_ACCOUNT_ID',
      !apiToken && 'CLOUDFLARE_API_TOKEN',
    ].filter(Boolean);
    throw new Error(`Missing Cloudflare credentials: ${missing.join(', ')}`);
  }

  return { accountId, apiToken };
}

/**
 * Validate configuration up front so a misconfigured server fails at startup
 * rather than on the first search.
 */
export async function initEmbedder(): Promise<void> {
  getCredentials();
  const model = getEmbeddingModel();
  const dims = getEmbeddingDimensions();
  console.log(`Using Cloudflare Workers AI embeddings (${model}, ${dims} dims)`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function embedBatch(texts: string[]): Promise<number[][]> {
  const { accountId, apiToken } = getCredentials();
  const model = getEmbeddingModel();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: texts }),
      });
    } catch (error) {
      // Network-level failure; worth retrying.
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }

    // 429 (rate limited) and 5xx are transient; anything else is not.
    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(
        `Cloudflare AI returned ${response.status}: ${await response.text()}`
      );
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Cloudflare AI returned ${response.status}: ${await response.text()}`
      );
    }

    const body = (await response.json()) as {
      result?: { data?: number[][] };
      data?: number[][];
      errors?: { message: string }[];
    };

    const data = body.result?.data ?? body.data;
    if (!data || data.length !== texts.length) {
      throw new Error(
        `Cloudflare AI returned ${data?.length ?? 0} embeddings for ${texts.length} inputs` +
          (body.errors?.length ? `: ${body.errors.map((e) => e.message).join('; ')}` : '')
      );
    }

    const expected = getEmbeddingDimensions();
    const actual = data[0]?.length ?? 0;
    if (actual !== expected) {
      throw new Error(
        `Model ${model} returned ${actual}-dim embeddings, expected ${expected}`
      );
    }

    return data;
  }

  throw new Error(
    `Cloudflare AI request failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text]);
  return embedding!;
}

export async function generateEmbeddings(
  texts: string[],
  batchSize = 50
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    allEmbeddings.push(...(await embedBatch(batch)));
  }

  return allEmbeddings;
}
