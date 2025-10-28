import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { signInAsGuest } from '@/utils/guestAuth';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/projects');
    }
  }, [user, loading]);

  const handleGuestMode = async () => {
    setGuestLoading(true);
    try {
      await signInAsGuest();
      toast.success('Welcome! You\'re in guest mode');
      navigate('/projects');
    } catch (error) {
      toast.error('Failed to start guest mode');
    } finally {
      setGuestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Interactive PDF Resume</h1>
          <p className="text-muted-foreground">Create interactive resumes with photo carousels</p>
        </div>

        <AuthForm />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleGuestMode}
          disabled={guestLoading}
        >
          {guestLoading ? 'Starting...' : 'Continue as Guest'}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Guest mode: Try it out without signing up. Your work is saved temporarily.
        </p>
      </div>
    </div>
  );
};

export default Index;
