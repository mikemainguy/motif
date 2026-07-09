export function formatJsonResponse(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function formatErrorResponse(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [
      {
        type: 'text' as const,
        text: `Error ${context}: ${message}`,
      },
    ],
  };
}

export function formatNoResultsResponse(query: string, resourceType: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `No ${resourceType} found for "${query}". Try different search terms.`,
      },
    ],
  };
}

export function formatNotFoundResponse(identifier: string, resourceType: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${resourceType} not found: ${identifier}. Use list_chapters to see available chapters.`,
      },
    ],
  };
}
