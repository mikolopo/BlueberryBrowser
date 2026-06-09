# Blueberry Browser

Electron browser with Berry, an AI sidebar agent. Navigate any site, run multi-step browser actions, WebMCP on demo pages, and reusable action recipes.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Add an API key in `.env` (OpenAI, Anthropic, DeepSeek, or Gemini).

## Scripts

- `pnpm dev` — development
- `pnpm typecheck` — TypeScript check
- `pnpm build` — production build

## WebMCP demos

Open `/demo/index.html` in dev, enable WebMCP in chat settings, try flights, shop, or focus demos.
