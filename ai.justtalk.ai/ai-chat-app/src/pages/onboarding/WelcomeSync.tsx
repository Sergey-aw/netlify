import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Bot, UserRound } from 'lucide-react';

export default function WelcomeSync() {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gradient-to-br from-purple-200 via-blue-200 to-purple-200 flex items-center justify-center p-4">
      <div className="w-full h-full max-w-md flex flex-col">
        <Card className="bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl p-8 flex-1 flex flex-col space-y-6 border-0 overflow-y-auto">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-gray-900">
              Switch seamlessly
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              AI practice + live tutor. Same journey. Same progress.
            </p>
          </div>

          {/* AI Practice and Live Tutor Cards */}
          <div className="flex items-center justify-center gap-4">
            {/* AI Practice Card */}
            <div className="flex-1 bg-gray-50 rounded-3xl p-6 flex flex-col items-center justify-center space-y-3 min-h-[180px]">
              <div className="w-16 h-16 flex items-center justify-center">
                <Bot className="w-14 h-14 text-gray-900" strokeWidth={1} />
              </div>
              <span className="text-lg font-semibold text-gray-900">AI Practice</span>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-8 h-8 text-gray-400 flex-shrink-0" strokeWidth={2} />

            {/* Live Tutor Card */}
            <div className="flex-1 bg-gray-50 rounded-3xl p-6 flex flex-col items-center justify-center space-y-3 min-h-[180px]">
              <div className="w-16 h-16 flex items-center justify-center">
                <UserRound className="w-14 h-14 text-gray-900" strokeWidth={1} />
              </div>
              <span className="text-lg font-semibold text-gray-900">Live Tutor</span>
            </div>
          </div>

          {/* Progress Message */}
          <div className="bg-purple-50 rounded-2xl px-6 py-4 text-center">
            <p className="text-lg text-gray-700 font-medium">
              Your progress stays with you
            </p>
          </div>

          {/* Always in sync Section */}
          <div className="space-y-3 flex-1">
            <h2 className="text-3xl font-bold text-gray-900">
              Always in sync
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Every word you speak counts — in every mode.
            </p>
          </div>

          {/* Continue Button */}
          <div className="pt-4">
            <Button
              onClick={() => navigate('/login')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-[24px] text-lg font-semibold shadow-lg"
            >
              Get Started
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
