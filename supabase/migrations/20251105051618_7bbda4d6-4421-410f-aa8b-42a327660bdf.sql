-- Drop existing restrictive policies for public reads
DROP POLICY IF EXISTS "Anyone can view published projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view regions of their projects" ON public.regions;
DROP POLICY IF EXISTS "Users can view photos in accessible regions" ON public.photos;

-- Create new PERMISSIVE policies for public access to published content
CREATE POLICY "Public can view published projects"
  ON public.projects
  FOR SELECT
  USING (published = true);

CREATE POLICY "Users can view their own projects"
  ON public.projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view regions of published projects"
  ON public.regions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = regions.project_id
      AND projects.published = true
    )
  );

CREATE POLICY "Users can view regions of their projects"
  ON public.regions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view photos in published projects"
  ON public.photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions
      JOIN projects ON projects.id = regions.project_id
      WHERE regions.id = photos.region_id
      AND projects.published = true
    )
  );

CREATE POLICY "Users can view photos in their projects"
  ON public.photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions
      JOIN projects ON projects.id = regions.project_id
      WHERE regions.id = photos.region_id
      AND projects.user_id = auth.uid()
    )
  );