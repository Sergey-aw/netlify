import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import Logo from '@/assets/logo.svg';

export default function WelcomeProgress() {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-gradient-to-br from-blue-300/80 via-blue-50 to-blue-100/20 flex items-center justify-center p-6">
      <div className="w-full h-full max-w-md flex flex-col justify-between py-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={Logo} alt="JustTalk" className="h-8" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center space-y-12">
          {/* Heading */}
          <div className="text-center space-y-4 px-4">
            <h1 className="text-4xl font-semibold text-[#39597D] leading-tight">
              Start speaking<br />confidently
            </h1>
            <p className="text-lg font-regular text-[#5983B3] leading-relaxed">
              Just talk 10 minutes a day and you will<br />gain your confidence within 2 weeks
            </p>
          </div>

          {/* Feature Cards */}
          <div className="space-y-6 px-2">
            {[1, 2, 3].map((item) => (
              <Card key={item} className="bg-white border-0 rounded-3xl p-3 shadow-md">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-pink-200 via-pink-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-7 h-7 text-pink-400" strokeWidth={2} />
                  </div>
                  {/* Text */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      You will reach your goal
                    </h3>
                    <p className="text-base text-gray-500">
                      You will reach your goal
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <div className="pt-6 px-2">
          <Button
            onClick={() => navigate('/welcome/features')}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-2xl text-lg font-semibold shadow-lg"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
