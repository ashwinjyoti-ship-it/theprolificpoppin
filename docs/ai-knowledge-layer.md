# AI Knowledge Layer

This project now has a database foundation for future AI work on the essay archive.

## What the layer is for

- Store each essay as a canonical record in Postgres
- Split essays into searchable chunks for retrieval
- Attach embeddings later for natural-language search
- Keep discussion threads and messages tied to the essay knowledge base
- Capture training examples for future model tuning or evaluation

## Database tables

- `essays`
- `essay_chunks`
- `ai_discussion_threads`
- `ai_discussion_messages`
- `ai_training_examples`

## How the site should use it later

1. Sync the current essay source into `essays`
2. Chunk each essay into `essay_chunks`
3. Create embeddings for each chunk
4. Retrieve the most relevant chunks for a user question
5. Feed the retrieved context to the model
6. Store the conversation and any useful examples back in Postgres

## Current status

- Neon project created and connected locally through `.env.local`
- The website is still static, so it does not query Neon yet
- The `lib/knowledge.ts` helper now defines the shape of the future knowledge documents and discussion prompts

## Next step when ready

Add a server-side API layer or a separate worker that reads `DATABASE_URL`, writes essay records into `essays`, and handles retrieval plus chat responses.

