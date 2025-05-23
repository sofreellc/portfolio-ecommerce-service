'use client';

import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { directSignIn, directSignOut } from '@/auth/form-signin';

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  // Add a timestamp that will change every time the page is generated
  const pageGeneratedTime = new Date().toISOString();
  // This will help us debug if we're seeing cached content

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Portfolio eCommerce</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          A modern eCommerce platform built with Next.js and AWS
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Page rendered at: {pageGeneratedTime}
        </p>
      </header>

      <main className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : session ? (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Welcome, {session.user?.name || 'User'}!</h2>
              <div className="inline-block relative">
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    width={80}
                    height={80}
                    className="rounded-full"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold mx-auto">
                    {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                  </div>
                )}
              </div>
            </div>
            
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
              <h3 className="font-medium mb-2">Session Info:</h3>
              <p><span className="font-semibold">Email:</span> {session.user?.email}</p>
              {session.user?.groups && (
                <p><span className="font-semibold">Groups:</span> {session.user.groups.join(', ')}</p>
              )}
              <p><span className="font-semibold">Status:</span> Authenticated</p>
            </div>
            
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => directSignOut('/')}
                className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Sign in to access your account and manage your profile
              </p>
            </div>

              <button
                onClick={() => directSignIn('cognito', '/')}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors flex items-center justify-center"
              >
                <span>Sign in with Cognito</span>
              </button>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4">
              <p>
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" className="text-blue-600 hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Portfolio eCommerce Service</p>
      </footer>
    </div>
  );
}
