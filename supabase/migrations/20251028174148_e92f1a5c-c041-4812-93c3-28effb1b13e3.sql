-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create storage buckets for PDFs and photos
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('resume-pdfs', 'resume-pdfs', true),
  ('carousel-photos', 'carousel-photos', true);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create regions table (boxes drawn on PDF)
CREATE TABLE public.regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create photos table
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  caption TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published projects"
  ON public.projects FOR SELECT
  USING (published = true);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for regions
CREATE POLICY "Users can view regions of their projects"
  ON public.regions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND (projects.user_id = auth.uid() OR projects.published = true)
    )
  );

CREATE POLICY "Users can create regions in their projects"
  ON public.regions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update regions in their projects"
  ON public.regions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete regions in their projects"
  ON public.regions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = regions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for photos
CREATE POLICY "Users can view photos in accessible regions"
  ON public.photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = photos.region_id
      AND (projects.user_id = auth.uid() OR projects.published = true)
    )
  );

CREATE POLICY "Users can create photos in their regions"
  ON public.photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = photos.region_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update photos in their regions"
  ON public.photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = photos.region_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete photos in their regions"
  ON public.photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.regions
      JOIN public.projects ON projects.id = regions.project_id
      WHERE regions.id = photos.region_id
      AND projects.user_id = auth.uid()
    )
  );

-- Storage policies for resume-pdfs bucket
CREATE POLICY "Anyone can view PDFs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resume-pdfs');

CREATE POLICY "Authenticated users can upload PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resume-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own PDFs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'resume-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own PDFs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resume-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for carousel-photos bucket
CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carousel-photos');

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'carousel-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'carousel-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'carousel-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();