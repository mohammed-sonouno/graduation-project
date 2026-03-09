-- Document that event_id is the link between each review and its event; analytics use it to scope by event.
COMMENT ON COLUMN event_reviews.event_id IS 'Event this review belongs to; analytics use this to attribute feedback to the correct event. NOT NULL, FK to events(id).';
