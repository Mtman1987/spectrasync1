
import { Suspense } from 'react';
import { getSession } from './actions';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { ManualLoginForm } from '@/components/manual-login-form';
import { Separator } from '@/components/ui/separator';

async function HomePage() {
  try {
    const session = await getSession();
    
    if (session.isLoggedIn) {
      redirect('/dashboard');
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="text-center space-y-8 p-8 bg-black/20 rounded-lg shadow-2xl backdrop-blur-sm">
          <h1 className="text-6xl font-bold mb-4">
            Cosmic Raid
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Manage, engage, and grow your Twitch community through seamless Discord integration.
          </p>
          <div className="space-y-4">
            <a 
              href="/api/auth/discord" 
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
            >
              Connect Discord Account
            </a>
            <p className="text-sm text-gray-400">
              Get started by connecting your Discord account
            </p>
          </div>
          
          <Separator className="bg-white/20 my-8" />

          <div>
             <p className="text-sm text-gray-400 mb-2">
                For development or testing, you can log in manually:
            </p>
            <ManualLoginForm />
          </div>

        </div>
      </div>
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error('Home page error:', error);
    
    // Fallback UI when services are unavailable
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-center space-y-8 p-8">
          <h1 className="text-6xl font-bold text-white mb-4">
            Cosmic Raid
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Setting up services... Please check back in a few minutes.
          </p>
          <div className="text-sm text-gray-400">
            <p>If this persists, check your Firebase configuration.</p>
          </div>
        </div>
      </div>
    );
  }
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <HomePage />
    </Suspense>
  );
}
