import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function RemoteLoginSuccess() {
  useEffect(() => {
    // Redirect to home page immediately
    // The login completes in the original browser tab via relay
    window.location.href = '/';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Redirecting...</h1>
      </div>
    </div>
  );
}

export default RemoteLoginSuccess;
