import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowUp } from 'lucide-react';
import { trackWelcomeStep } from '@/lib/posthog';

export default function WelcomeFeatures() {
  const navigate = useNavigate();
  
  useEffect(() => {
    trackWelcomeStep('features');
  }, []);

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-900 via-blue-600 to-indigo-800 flex flex-col items-center justify-center p-4">
      <div className="w-full h-full max-w-md flex flex-col justify-between py-4">
        <Card className="bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl p-8 border-0 w-full flex-shrink-0">
          {/* Adaptive Learning */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Adaptive Learning
          </h1>

          <div className="flex flex-wrap gap-3 mb-6">
            <div className="px-5 py-3 bg-green-100 rounded-2xl flex items-center gap-2">
              <span className="text-base font-semibold text-green-800">Vocabulary</span>
              <ArrowUp className="w-5 h-5 text-green-800 stroke-[2.5]" />
            </div>
            <div className="px-5 py-3 bg-purple-100 rounded-2xl flex items-center gap-2">
              <span className="text-base font-semibold text-purple-800">Speaking</span>
              <ArrowUp className="w-5 h-5 text-purple-800 stroke-[2.5]" />
            </div>
            <div className="px-5 py-3 bg-blue-100 rounded-2xl flex items-center gap-2">
              <span className="text-base font-semibold text-blue-800">Pronunciation</span>
              <ArrowUp className="w-5 h-5 text-blue-800 stroke-[2.5]" />
            </div>
          </div>

          <p className="text-lg text-gray-600 leading-relaxed">
            JustTalk AI learns from your performance and adapts your lessons automatically
          </p>
        </Card>

        {/* Improve Faster - Outside card */}
        <div className="text-center space-y-4 flex-1 flex flex-col justify-center">
          <h2 className="text-4xl font-bold text-white">
            Improve Faster
          </h2>
          <p className="text-lg text-white/90 leading-relaxed px-4">
            Your training gets harder when you're — and easier when needed.
          </p>
        </div>

        {/* Continue Button - Fixed at bottom */}
        <div className="w-full flex-shrink-0">
          <Button
            onClick={() => navigate('/welcome/sync')}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-[24px] text-lg font-semibold shadow-lg"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
