-- Drop the security definer view and replace with a regular view
DROP VIEW IF EXISTS public.public_projects;

CREATE VIEW public.public_projects AS
SELECT 
  id,
  title,
  slug,
  published,
  created_at,
  updated_at
FROM public.projects
WHERE published = true;

-- Grant select permission on the view
GRANT SELECT ON public.public_projects TO authenticated, anon;