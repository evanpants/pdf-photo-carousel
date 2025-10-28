import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import { getOrCreateGuestSessionId } from '@/utils/guestSession';
import Dashboard from './Dashboard';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const [guestMode, setGuestMode] = useState(false);
  const [guestSessionId, setGuestSessionId] = useState<string>('');

  const handleGuestMode = () => {
    const sessionId = getOrCreateGuestSessionId();
    setGuestSessionId(sessionId);
    setGuestMode(true);
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
    return <Dashboard />;
  }

  if (guestMode) {
    return <Dashboard isGuest guestSessionId={guestSessionId} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Interactive Resume Builder</h1>
          <p className="text-muted-foreground">Create professional resumes with ease</p>
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

        <Button variant="outline" className="w-full" onClick={handleGuestMode}>
          Continue as Guest
        </Button>
      </div>
    </div>
  );
};

export default Index;
