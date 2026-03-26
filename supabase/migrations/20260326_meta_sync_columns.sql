-- Add Meta Marketing API external IDs to campaigns / adsets / ads
-- These let us upsert from the Graph API without duplicating rows.

-- campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS metacampaignid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_metacampaignid
  ON campaigns (metacampaignid)
  WHERE metacampaignid IS NOT NULL;

-- adsets
ALTER TABLE adsets
  ADD COLUMN IF NOT EXISTS metaadsetid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_adsets_metaadsetid
  ON adsets (metaadsetid)
  WHERE metaadsetid IS NOT NULL;

-- ads
ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS metaadid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_metaadid
  ON ads (metaadid)
  WHERE metaadid IS NOT NULL;
