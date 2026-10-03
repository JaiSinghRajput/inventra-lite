import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { registerStoreFn } from '../../features/auth/server';
import { authClient } from '../../features/auth/auth-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Store } from 'lucide-react';
import { GoogleIcon } from '../../components/ui/google-icon';

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
});

function RegisterComponent() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check URL query parameters for OAuth error
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error') || params.get('error_description') || params.get('message');
      if (urlError) {
        if (urlError.toLowerCase().includes('access_denied')) {
          setError('Google sign-up was cancelled. Please try again.');
        } else if (urlError.toLowerCase().includes('redirect_uri_mismatch')) {
          setError('OAuth redirect URI mismatch. Please ensure this origin is added to Authorized Redirect URIs in Google Cloud Console.');
        } else {
          setError(`Sign-up error: ${urlError}`);
        }
      }
    }
  }, []);

  // If already authenticated, redirect to /pos
  React.useEffect(() => {
    let isMounted = true;
    authClient.getSession().then((res) => {
      if (res?.data?.user && isMounted) {
        window.location.href = '/pos';
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const validateForm = () => {
    if (!storeName.trim()) {
      setError('Please enter your store or business name.');
      return false;
    }
    if (!ownerName.trim()) {
      setError('Please enter your full name as store owner.');
      return false;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter an email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setError('');
    setLoading(true);

    try {
      await registerStoreFn({
        data: {
          storeName: storeName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim().toLowerCase(),
          password,
          currency: 'INR',
        },
      });

      // Automatically sign in with the new credentials (persist session)
      const signInRes = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe: true,
      });

      if (signInRes?.error) {
        window.location.href = '/login?registered=true';
      } else {
        // Direct browser navigation guarantees fresh cookie propagation to SSR and server functions
        window.location.href = '/pos';
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/pos',
      });
      if (res?.error) {
        setError(res.error.message || 'Google sign up failed. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign up failed. Please verify your connection.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-2 shadow-sm">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Set Up Your Store</h2>
          <p className="text-xs text-slate-500 mt-0.5">Start billing in seconds with Inventra Lite</p>
        </div>

        <Card className="shadow-md border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Store Registration</h3>
          <p className="text-xs text-slate-500 mb-4">
            Your store name will generate your unique sequential SKU prefix (e.g. RAJ-000001).
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            <GoogleIcon className="w-4 h-4" />
            <span>Sign up with Google</span>
          </button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Or with email & store details
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Store / Business Name"
              placeholder="e.g. Raj Hardware & Electricals"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Owner Full Name"
              placeholder="e.g. Rajesh Kumar"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />

            <Input
              label="Owner Email Address"
              type="email"
              placeholder="e.g. rajesh@store.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password (min 6 characters)"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            <Button type="submit" className="w-full mt-2" isLoading={loading}>
              Create Store & Start Billing
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 hover:text-brand-700 font-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
