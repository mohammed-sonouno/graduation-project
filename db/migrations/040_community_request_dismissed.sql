-- Let requesters hide rejected/pending request cards from their list (soft dismiss).
ALTER TABLE community_requests
  ADD COLUMN IF NOT EXISTS dismissed_by_requester BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_community_requests_requester_dismissed
  ON community_requests (requester_id) WHERE COALESCE(dismissed_by_requester, false) = false;
