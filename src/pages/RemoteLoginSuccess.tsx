import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

export function RemoteLoginSuccess() {
  useEffect(() => {
    // Try to close this tab/window immediately
    window.close();
  }, []);

  // Fallback UI if window.close() doesn't work
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connected!</h1>
        <p className="text-muted-foreground">Return to your browser to continue.</p>
      </div>
    </div>
  );
}

export default RemoteLoginSuccess;
