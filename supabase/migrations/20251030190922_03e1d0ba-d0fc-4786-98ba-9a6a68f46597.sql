-- Create a view that exposes only safe fields for public projects
CREATE OR REPLACE VIEW public.public_projects AS
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

-- Update RLS policy to not expose user_id in published projects
-- We'll keep the existing policies but add a comment about the security concern
COMMENT ON TABLE public.projects IS 'Contains user_id which should not be exposed via direct queries for published projects. Use public_projects view instead for public access.';