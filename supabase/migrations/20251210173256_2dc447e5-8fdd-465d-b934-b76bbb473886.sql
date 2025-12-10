-- Drop existing restrictive policies for public access
DROP POLICY IF EXISTS "Public can view published projects" ON public.projects;
DROP POLICY IF EXISTS "Public can view regions of published projects" ON public.regions;
DROP POLICY IF EXISTS "Public can view photos in published projects" ON public.photos;

-- Recreate as PERMISSIVE policies (default) so anonymous users can access published content
CREATE POLICY "Public can view published projects" 
ON public.projects 
FOR SELECT 
USING (published = true);

CREATE POLICY "Public can view regions of published projects" 
ON public.regions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = regions.project_id 
  AND projects.published = true
));

CREATE POLICY "Public can view photos in published projects" 
ON public.photos 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM regions 
  JOIN projects ON projects.id = regions.project_id 
  WHERE regions.id = photos.region_id 
  AND projects.published = true
));