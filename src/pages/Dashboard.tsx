import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { viewPdfInNewTab } from '@/utils/pdfViewer';
import { toast } from 'sonner';

interface DashboardProps {
  isGuest?: boolean;
  guestSessionId?: string;
}

export default function Dashboard({ isGuest, guestSessionId }: DashboardProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [skills, setSkills] = useState('');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
  };

  const handleViewPdf = async () => {
    try {
      // Replace with actual PDF path from your storage
      await viewPdfInNewTab('your-resume.pdf');
    } catch (error) {
      toast.error('Failed to open PDF', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleGeneratePdf = () => {
    toast.info('PDF generation will be implemented with your backend');
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Interactive Resume Builder</h1>
            <p className="text-muted-foreground">
              {isGuest ? `Guest Mode (${guestSessionId})` : 'Create your professional resume'}
            </p>
          </div>
          {!isGuest && (
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Enter your basic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional Summary</CardTitle>
            <CardDescription>Brief overview of your professional background</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Experienced professional with..."
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
            <CardDescription>Your employment history</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Senior Developer at Company X (2020-2024)..."
              rows={6}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
            <CardDescription>Your educational background</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Bachelor of Science in Computer Science..."
              rows={4}
              value={education}
              onChange={(e) => setEducation(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>Your key competencies</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="JavaScript, React, Node.js, Python..."
              rows={4}
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button onClick={handleGeneratePdf} className="flex-1">
            Generate PDF
          </Button>
          <Button onClick={handleViewPdf} variant="outline" className="flex-1">
            View Sample PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
