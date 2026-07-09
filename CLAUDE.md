# Motif ES Manual MCP Server

## Project Overview
TypeScript + Express MCP server exposing the Yamaha MOTIF ES Owner's Manual via Model Context Protocol.

## Key Commands
- `npm run build` — Compile TypeScript
- `npm start` — Run the server (port 3001)
- `npm run ingest` — Build/rebuild the SQLite RAG database from data files
- `npm run typecheck` — Type-check without emitting
- Never run `npm run dev`

## Architecture
- MCP endpoint: `POST /mcp` (Streamable HTTP transport)
- Data files in `data/` — do not modify
- `data/motif.db` — SQLite database with FTS5 + sqlite-vec (generated, gitignored)
- Follows same patterns as babylon-mcp sibling project

## RAG Search
- SQLite with sqlite-vec (vector KNN) + FTS5 (keyword BM25)
- Hybrid search via Reciprocal Rank Fusion
- Embeddings: Xenova/all-MiniLM-L6-v2 (384 dims, local)
- Graceful fallback to keyword search if DB not built

## Tools Exposed
- `list_chapters` — List all manual chapters
- `read_chapter` — Read chapter content (supports pagination)
- `search_manual` — Hybrid semantic + keyword search (falls back to keyword if no DB)
