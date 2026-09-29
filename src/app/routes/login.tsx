import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { authClient } from '../../features/auth/auth-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Calculator } from 'lucide-react';
import { GoogleIcon } from '../../components/ui/google-icon';

export const Route = createFileRoute('/login')({
  component: LoginComponent,
});

function LoginComponent() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.error) {
        setError(res.error.message || 'Invalid email or password');
      } else {
        navigate({ to: '/pos' });
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/pos',
      });
    } catch (err: any) {
      setError(err?.message || 'Google sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white mb-2 shadow-sm">
            <Calculator className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Inventra Lite</h2>
          <p className="text-xs text-slate-500 mt-0.5">Counter POS & Inventory Management</p>
        </div>

        <Card className="shadow-md border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Staff / Owner Login</h3>
          <p className="text-xs text-slate-500 mb-4">Enter your account credentials to access your store register.</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            <GoogleIcon className="w-4 h-4" />
            <span>Continue with Google</span>
          </button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              Or with email
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. cashier@store.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full mt-2" isLoading={loading}>
              Sign In to Register
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              New store owner?{' '}
              <Link to="/register" className="text-brand-600 hover:text-brand-700 font-semibold">
                Register Store
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
