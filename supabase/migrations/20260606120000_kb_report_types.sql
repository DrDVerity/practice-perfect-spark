-- Add new knowledge-base document types for the onboarding research suite.
-- Each ADD VALUE is in its own migration file (not referenced within this file)
-- so Postgres can commit the enum change before any row uses the new value.

ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'reputation_sentiment';
ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'social_media';
ALTER TYPE public.kb_document_type ADD VALUE IF NOT EXISTS 'business_dna';
