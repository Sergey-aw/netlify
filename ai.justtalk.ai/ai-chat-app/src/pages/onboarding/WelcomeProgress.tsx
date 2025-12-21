import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageCircle, Target, TrendingUp } from 'lucide-react';
import Logo from '@/assets/logo.svg';

const CARD_STACK_HEIGHT = 320;

const steps = [
  {
    id: 1,
    title: "Start speaking\nconfidently",
    subtitle: "Just talk 10 minutes a day and you will\ngain your confidence within 2 weeks",
    background: "bg-gradient-to-br from-blue-300/80 via-blue-50 to-blue-100/20",
    cards: [
      { icon: MessageCircle, title: "Practice daily conversations", desc: "Build fluency through everyday" },
      { icon: MessageCircle, title: "Get instant feedback", desc: "Improve pronunciation and grammar" },
      { icon: MessageCircle, title: "Track your progress", desc: "See your improvement over time" },
    ]
  },
  {
    id: 2,
    title: "Achieve your\ngoals faster",
    subtitle: "Personalized learning path designed\njust for you",
    background: "bg-gradient-to-bl from-purple-300/80 via-purple-50 to-pink-100/20",
    cards: [
      { icon: Target, title: "Set clear objectives", desc: "Define what you want to achieve" },
      { icon: Target, title: "Follow your path", desc: "Step-by-step guidance" },
      { icon: Target, title: "Celebrate milestones", desc: "Track achievements" },
    ]
  },
  {
    id: 3,
    title: "Learn with\nAI & experts",
    subtitle: "Combine AI practice with live tutoring\nfor the best results",
    background: "bg-gradient-to-tr from-indigo-300/80 via-cyan-50 to-teal-100/20",
    cards: [
      { icon: TrendingUp, title: "AI-powered practice", desc: "Available 24/7" },
      { icon: TrendingUp, title: "Expert tutors", desc: "Get human feedback and guidance" },
      { icon: TrendingUp, title: "Seamless sync", desc: "Same progress across both methods" },
    ]
  }
];

export default function WelcomeProgress() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const handleContinue = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate('/welcome/features');
    }
  };

  const step = steps[currentStep];

  return (
    <div className="h-screen bg-gradient-to-br from-blue-300/80 via-blue-50/20 to-white flex items-center justify-center p-6">
      <div className="w-full h-full max-w-md flex flex-col justify-between py-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={Logo} alt="JustTalk" className="h-8" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Heading - Fixed height container */}
          <div className="text-center px-4" style={{ minHeight: '80px', marginBottom: '16px' }}>
            {/* Title */}
            <div className="relative font-din overflow-hidden" style={{ height: '112px', marginBottom: '16px' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`title-${step.id}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <h1 className="text-4xl font-semibold text-[#39597D] leading-tight whitespace-pre-line">
                    {step.title}
                  </h1>
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Subtitle */}
            <div className="relative overflow-hidden" style={{ height: '64px' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`subtitle-${step.id}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <p className="text-lg font-medium text-[#5983B3] leading-tight whitespace-pre-line">
                    {step.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="px-2">
            <div className="relative" style={{ height: `${CARD_STACK_HEIGHT}px` }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`card-set-${step.id}`}
                  className="absolute inset-0 space-y-6"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  {step.cards.map((card, index) => (
                    <motion.div
                      key={`card-${step.id}-${index}`}
                      custom={index}
                      initial={{ x: 60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -60, opacity: 0 }}
                      transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 300,
                        mass: 1,
                        delay: index * 0.1 + 0.1
                      }}
                    >
                      <Card className="bg-white border-0 rounded-3xl p-3 shadow-md">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-pink-200 via-pink-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                            <card.icon className="w-7 h-7 text-pink-400" strokeWidth={2} />
                          </div>
                          {/* Text */}
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 mb-1">
                              {card.title}
                            </h3>
                            <p className="text-base text-gray-500">
                              {card.desc}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="pt-6 px-2">
          <Button
            onClick={handleContinue}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-2xl text-lg font-semibold shadow-lg"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
