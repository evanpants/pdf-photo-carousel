-- Remove the view entirely as it's not needed - existing RLS policies handle access
DROP VIEW IF EXISTS public.public_projects;