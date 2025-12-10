import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { checkEmailExists } from '@/lib/justai-api';
import { AlertCircle } from 'lucide-react';
import Logo from '@/assets/logo.svg';

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Check if user exists first
      const { exists } = await checkEmailExists(email);
      
      if (!exists) {
        setError('No account found with this email. Please sign up first.');
        setIsLoading(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      
      if (signInError) {
        // Provide more specific error messages
        if (signInError.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please try again.');
        }
        throw signInError;
      }
      
      if (data.user) {
        // Successfully signed in, navigate to main app
        navigate('/ai-chat');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Check if user exists and can use magic link
      const { exists, canUseMagicLink } = await checkEmailExists(email);
      
      if (!exists) {
        setError('No account found with this email. Please sign up first.');
        setIsLoading(false);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return;
      }

      // Check if this user can actually use magic link (not an anonymous user)
      if (!canUseMagicLink) {
        setError('Magic link is not available for your account type. Please use password sign-in or set a password first.');
        setIsLoading(false);
        return;
      }

      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/ai-chat`,
          shouldCreateUser: false, // Prevent creating new users
        },
      });
      
      if (magicLinkError) {
        throw magicLinkError;
      }
      
      // Show success message
      alert('Magic link sent! Check your email to sign in.');
    } catch (err: any) {
      console.error('Magic link error:', err);
      setError(err.message || 'Failed to send magic link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F5F5] p-4">
      <Card className="w-full max-w-[480px] shadow-sm">
        <CardContent className="pt-12 pb-8 px-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={Logo} alt="JustTalk" className="h-12" />
          </div>

          {/* Title */}
          <h1 className="text-center text-[#666666] text-sm font-normal mb-10">
            Login to your account to practice<br /> English with our advanced JustTalk AI teacher
          </h1>
          
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="m@example.com"
                disabled={isLoading}
                required
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center space-x-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Login button */}
            <Button
              type="submit"
              className="w-full bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">Or</span>
              </div>
            </div>
          </div>

          {/* Magic link button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleMagicLink}
            disabled={isLoading || !email}
            className="w-full"
          >
            Send Magic Link
          </Button>
          {!email && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Enter your email above to use magic link
            </p>
          )}

          {/* Sign up link */}
          <div className="mt-8 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link to="/login" className="text-foreground underline font-medium hover:no-underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="fixed bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
        <span>By clicking continue, you agree to our </span>
        <Link to="/terms" className="underline hover:no-underline">
          Terms of Service
        </Link>
        <span> and </span>
        <Link to="/privacy" className="underline hover:no-underline">
          Privacy Policy
        </Link>
        <span>.</span>
      </div>
    </div>
  );
}
