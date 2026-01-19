import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Logo from '@/assets/logo.svg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/setup-password`,
        }
      );
      
      if (resetError) throw resetError;
      
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F5F5] p-4">
      <Card className="w-full max-w-[480px] shadow-sm">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="flex justify-center mb-4">
            <img src={Logo} alt="JustTalk" className="h-10" />
          </div>
          <CardTitle className="text-base font-medium">Reset your password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to reset your password.
                </p>
              </div>
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  className="w-full"
                >
                  Send another email
                </Button>
              </div>
              <div className="text-center text-sm">
                <Link to="/signin" className="text-foreground underline hover:no-underline">
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>

              <div className="text-center text-sm space-y-2">
                <div>
                  <Link to="/signin" className="text-foreground underline hover:no-underline">
                    Back to sign in
                  </Link>
                </div>
                <div className="text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/login" className="text-foreground underline hover:no-underline">
                    Sign up
                  </Link>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
        <span>Need help? Contact us at </span>
        <a href="mailto:support@justtalk.ai" className="underline hover:no-underline">
          support@justtalk.ai
        </a>
      </div>
    </div>
  );
}
