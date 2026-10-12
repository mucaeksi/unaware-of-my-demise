-- New obligations freeze their benefits; existing unsnapshotted orders remain explicit legacy review work.
ALTER TABLE purchases ADD COLUMN fulfillment TEXT CHECK (fulfillment IS NULL OR json_valid(fulfillment));
ALTER TABLE purchases ADD COLUMN entitlement_state TEXT NOT NULL DEFAULT 'active'
  CHECK (entitlement_state IN ('active', 'canceled', 'in_grace', 'on_hold', 'paused', 'expired', 'pending', 'unknown'));
ALTER TABLE purchases ADD COLUMN entitlement_checked_at TEXT;
CREATE TRIGGER purchases_fulfillment_immutable BEFORE UPDATE OF fulfillment ON purchases
  WHEN OLD.fulfillment IS NOT NULL AND NEW.fulfillment IS NOT OLD.fulfillment
  BEGIN SELECT RAISE(ABORT, 'purchase fulfillment is immutable'); END;
