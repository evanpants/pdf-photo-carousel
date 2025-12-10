-- Make storage buckets private
UPDATE storage.buckets SET public = false WHERE id = 'resume-pdfs';
UPDATE storage.buckets SET public = false WHERE id = 'carousel-photos';