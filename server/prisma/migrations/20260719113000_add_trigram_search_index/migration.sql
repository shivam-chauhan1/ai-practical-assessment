-- Enable the pg_trgm extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a GIN trigram index on title and description for fast ILIKE searches
CREATE INDEX idx_ticket_search_trgm
  ON "Ticket"
  USING GIN (
    (title || ' ' || description) gin_trgm_ops
  );
