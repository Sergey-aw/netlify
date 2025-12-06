import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/hooks/useSession';
import { supabase } from '@/lib/supabase';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';

export default function EmailVerification() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [email, setEmail] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    // Get the email from localStorage or user metadata
    const storedEmail = localStorage.getItem('justai_pending_email');
    const userEmail = user?.user_metadata?.email;
    
    const emailToUse = storedEmail || userEmail;
    
    if (emailToUse) {
      setEmail(emailToUse);
    } else {
      // If no email found, redirect to login
      navigate('/login');
    }
  }, [user, navigate]);

  const handleResendEmail = async () => {
    if (!email) return;
    
    setIsResending(true);
    setResendMessage('');
    
    try {
      // Send magic link to the email
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/ai-chat`,
        },
      });
      
      if (error) throw error;
      
      setResendMessage('Verification email sent! Check your inbox.');
    } catch (error) {
      console.error('Error resending email:', error);
      setResendMessage('Failed to send email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleManualSignIn = () => {
    navigate('/signin');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription className="text-base mt-2">
            We've sent a verification link to
          </CardDescription>
          <p className="font-semibold text-lg text-gray-900 mt-1">{email}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-2">Complete your setup:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Check your email inbox</li>
                  <li>Click the verification link</li>
                  <li>You'll be automatically signed in</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Resend button */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">Didn't receive the email?</p>
            <Button
              variant="outline"
              onClick={handleResendEmail}
              disabled={isResending}
              className="w-full"
            >
              {isResending ? 'Sending...' : 'Resend Verification Email'}
            </Button>
            {resendMessage && (
              <p className={`text-sm ${resendMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {resendMessage}
              </p>
            )}
          </div>

          {/* Alternative sign-in */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 text-center mb-3">
              Already verified your email?
            </p>
            <Button
              variant="default"
              onClick={handleManualSignIn}
              className="w-full"
            >
              Sign In with Password
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Help text */}
          <p className="text-xs text-gray-500 text-center">
            If you can't find the email, check your spam folder or contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
