import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Briefcase, Plus } from 'lucide-react';

export default function WelcomeProgress() {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full h-full max-w-md flex flex-col">
        <Card className="bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl p-8 flex-1 flex flex-col space-y-6 border-0 overflow-y-auto">
          {/* Progress Card */}
          <Card className="bg-gradient-to-br from-blue-50/80 to-purple-50/80 border-0 p-6 rounded-3xl">
            <div className="mb-3">
              <p className="text-l font-semibold text-gray-900">30 min/day</p>
            </div>

            <div className="mb-6">
              <p className="text-base text-gray-600 mb-1">You'll reach your goal</p>
              <p className="text-3xl font-bold text-gray-900">3 Months</p>
            </div>

            {/* Progress Line - Cleaner version */}
            <div className="relative h-28 mb-2">
              <svg
                viewBox="0 0 500 100"
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Progress path - smooth S-curve */}
                <path
                  d="M 30 85 Q 120 85 180 60 Q 240 35 340 30 Q 400 27 470 25"
                  fill="none"
                  stroke="#4F5B6C"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Start point - larger circle */}
                <circle 
                  cx="30" 
                  cy="85" 
                  r="14" 
                  fill="white" 
                  stroke="#4F5B6C" 
                  strokeWidth="5" 
                />
                <circle 
                  cx="30" 
                  cy="85" 
                  r="6" 
                  fill="#4F5B6C" 
                />
                {/* End point with flag */}
                <circle 
                  cx="470" 
                  cy="25" 
                  r="22" 
                  fill="white" 
                  stroke="#D1D5DB" 
                  strokeWidth="4" 
                />
                <text 
                  x="470" 
                  y="34" 
                  textAnchor="middle" 
                  fontSize="24"
                  className="select-none"
                >🏁</text>
              </svg>
              {/* Labels */}
              <div className="flex justify-between items-center pt-1">
                <span className="text-base font-medium text-gray-700 ml-1">Today</span>
                <span className="text-base font-medium text-gray-700 mr-1">3 months</span>
              </div>
            </div>
          </Card>

          {/* Learning Goals */}
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#4F5B6C] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Check className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <span className="text-lg font-normal text-gray-900">Vocabulary</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-white border-0 shadow-sm flex items-center justify-center flex-shrink-0">
                <span className="text-xl">😊</span>
              </div>
              <span className="text-lg font-normal text-gray-900">Speak as a native</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#5B6470] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Briefcase className="w-4 h-4 text-white stroke-[2]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-normal text-gray-900">Speaking</span>
                <span className="text-lg font-normal text-gray-900">Tense Practice</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#5B6470] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-normal text-gray-900">Role-play</span>
                <span className="text-lg font-normal text-gray-900">Job Interview</span>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-1 flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Progress & Grow</h2>
            <p className="text-gray-600 text-base leading-relaxed">
              JustTalk AI creates personalized learning plan for you
            </p>
          </div>

          {/* Continue Button */}
          <div className="pt-4">
            <Button
              onClick={() => navigate('/welcome/features')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-[24px] text-lg font-semibold shadow-lg"
            >
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
