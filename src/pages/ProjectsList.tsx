import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Copy, Check, ExternalLink } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  pdf_path: string;
}

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const navigate = useNavigate();

  const getGithubPagesUrl = (slug: string) => {
    return `https://evanpants.github.io/pdf-photo-carousel/view/${slug}`;
  };

  const copyGithubUrl = (slug: string) => {
    navigator.clipboard.writeText(getGithubPagesUrl(slug));
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
    toast.success('GitHub URL copied!');
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load projects');
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  const handleCreateProject = async () => {
    if (!title || !pdfFile) {
      toast.error('Please enter a title and select a PDF file');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload PDF
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('resume-pdfs')
        .upload(fileName, pdfFile);

      if (uploadError) throw uploadError;

      // Create project
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const { error: insertError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title,
          pdf_path: fileName,
          slug,
        });

      if (insertError) throw insertError;

      toast.success('Project created successfully!');
      setOpen(false);
      setTitle('');
      setPdfFile(null);
      loadProjects();
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, pdfPath: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await supabase.storage.from('resume-pdfs').remove([pdfPath]);
      await supabase.from('projects').delete().eq('id', id);
      toast.success('Project deleted');
      loadProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Projects</h1>
            <p className="text-muted-foreground">Create interactive PDF resumes with photo carousels</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>Upload a PDF resume and give it a title</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title</Label>
                    <Input
                      id="title"
                      placeholder="My Interactive Resume"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf">PDF File</Label>
                    <Input
                      id="pdf"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button onClick={handleCreateProject} disabled={uploading} className="w-full">
                    {uploading ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {project.title}
                </CardTitle>
                <CardDescription>
                  {project.published ? (
                    <span className="text-green-600">Published</span>
                  ) : (
                    <span className="text-yellow-600">Draft</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last updated {new Date(project.updated_at).toLocaleDateString()}
                </p>
                {project.published && (
                  <div className="flex items-center gap-1 mt-2">
                    <Input
                      readOnly
                      value={getGithubPagesUrl(project.slug)}
                      className="text-xs h-8 flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyGithubUrl(project.slug)}
                    >
                      {copiedSlug === project.slug ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => window.open(getGithubPagesUrl(project.slug), '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => navigate(`/editor/${project.id}`)}
                >
                  Edit
                </Button>
                {project.published && (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => window.open(`/view/${project.slug}`, '_blank')}
                  >
                    View
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(project.id, project.pdf_path)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {projects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first interactive PDF resume
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
