import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Target, Mic, Lightbulb, BookOpen, Route, Trophy, Bot, Users, RefreshCw } from 'lucide-react';
import Logo from '@/assets/logo.svg';
import bgWelcome from '@/assets/bg_welcome.jpg';
import progressWordsAcquired from '@/assets/progress-words-acquired.png';
import progressCefrLevel from '@/assets/progress-cefr-level.png';
import progressMlScore from '@/assets/progress-ml-score.png';
import progressPronunciation from '@/assets/progress-pronunciation.png';
import progressSpeakWords from '@/assets/progress-speak-words.png';
import { PersonalityCarousel } from '@/components/PersonalityCarousel';
import { RolePlayCarousel } from '@/components/RolePlayCarousel';
import { trackWelcomeStep } from '@/lib/posthog';

const steps = [
  {
    id: 1,
    title: "Get better at speaking\nby speaking",
    subtitle: "Natural voice conversations that help you improve as you talk",
    background: "bg-gradient-to-br from-blue-300/80 via-blue-50 to-blue-100/20",
    cards: [
      { icon: Mic, title: "Natural voice conversations", desc: "Speak freely, without scripts or exercises" },
      { icon: Lightbulb, title: "Helpful feedback after you speak", desc: "Learn from your own words—after the conversation" },
      { icon: BookOpen, title: "Vocabulary that grows with you", desc: "Track the words you actually use" },
    ]
  },
  {
    id: 2,
    title: "Talk with different personalities",
    subtitle: "Some are supportive. Some challenge you. All help you practice real conversations",
    background: "bg-gradient-to-bl from-purple-300/80 via-purple-50 to-pink-100/20",
    cards: [
      { icon: Target, title: "Set clear objectives", desc: "Define what you want to achieve" },
      { icon: Route, title: "Follow your path", desc: "Step-by-step guidance" },
      { icon: Trophy, title: "Celebrate milestones", desc: "Track achievements" },
    ]
  },
  {
    id: 3,
    title: "Practice real situations",
    subtitle: "Practice real conversations — from casual chats to high-pressure moments",
    background: "bg-gradient-to-tr from-indigo-300/80 via-cyan-50 to-teal-100/20",
    cards: [
      { icon: Bot, title: "AI-powered practice", desc: "Available 24/7" },
      { icon: Users, title: "Expert tutors", desc: "Get human feedback and guidance" },
      { icon: RefreshCw, title: "Seamless sync", desc: "Same progress across both methods" },
    ]
  },
  {
    id: 4,
    title: "Turn conversations\ninto progress",
    subtitle: "See how your speaking improves after every conversation",
    background: "bg-gradient-to-br from-blue-300/80 via-blue-50 to-blue-100/20",
    showProgress: true
  }
];

export default function WelcomeProgress() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [glowingCard, setGlowingCard] = useState<string | null>(null);
  
  // Track page view on mount
  useState(() => {
    trackWelcomeStep('progress', { step_number: currentStep });
  });

  const handleCardClick = (cardId: string) => {
    setGlowingCard(cardId);
    setTimeout(() => setGlowingCard(null), 1000);
  };

  const handleContinue = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      trackWelcomeStep('progress', { step_number: currentStep + 1 });
    } else {
      navigate('/onboarding/pronunciation');
    }
  };

  const step = steps[currentStep];

  return (
     <div 
      className="h-screen flex items-center justify-center p-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgWelcome})` }}
    >
    
      <div className="w-full h-full max-w-md flex flex-col py-2">
        {/* Logo */}
        <div className="flex justify-center flex-shrink-0">
          <img src={Logo} alt="JustTalk" className="h-7" />
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-[8px]" />

        {/* Heading - Flexible height container */}
        <div className="text-center px-4 flex-shrink-0">
            {/* Title */}
            <div className="relative font-din overflow-hidden mb-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`title-${step.id}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <h1 className="font-semibold text-[#39597D] leading-tight whitespace-pre-line text-[clamp(1.4rem,6vw,1.875rem)]">
                    {step.title}
                  </h1>
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Subtitle */}
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`subtitle-${step.id}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
                >
                  <p className="text-base font-medium text-[#5983B3] leading-tight whitespace-pre-line text-[clamp(0.6rem,4vw,1.125rem)]">
                    {step.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-[6 px]" />

          {/* Feature Cards */}
          <div className={step.id === 2 || step.id === 3 ? '-mx-6' : 'px-2'}>
            <div className="relative flex-shrink-0" style={{ minHeight: '350px', maxHeight: '400px' }}>
              <AnimatePresence mode="wait">
                {step.id === 2 ? (
                  <motion.div
                    key="personality-carousel"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                    className="h-full"
                  >
                    <PersonalityCarousel />
                  </motion.div>
                ) : step.id === 3 ? (
                  <motion.div
                    key="roleplay-carousel"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                    className="h-full"
                  >
                    <RolePlayCarousel />
                  </motion.div>
                ) : step.id === 4 ? (
                  <motion.div
                    key="progress-stats"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                    className="h-full flex items-center justify-center"
                  >
                    <div className="relative w-full max-w-[320px] mx-auto" style={{ aspectRatio: '1', maxHeight: '360px' }}>
                      {/* Top Left - Words Acquired */}
                      <motion.div
                        initial={{ x: -40, opacity: 0 }}
                        animate={{ 
                          x: 0, 
                          opacity: 1,
                          y: [0, -8, 0]
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardClick('words')}
                        transition={{ 
                          x: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.1 },
                          opacity: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.1 },
                          y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.7 }
                        }}
                        className="absolute rounded-[16px] cursor-pointer"
                        style={{ 
                          left: '3%', 
                          top: '6%', 
                          width: '44%', 
                          height: '20%',
                          boxShadow: glowingCard === 'words' 
                            ? '0px 0px 20px 4px hsl(var(--brand-blue))' 
                            : '0px 4px 15px 0px rgba(0,0,0,0.15)',
                          transition: 'box-shadow 0.3s ease'
                        }}
                      >
                        <img 
                          src={progressWordsAcquired} 
                          alt="Words acquired" 
                          className="absolute inset-0 w-full h-full object-contain bg-white/80 rounded-[16px] p-1"
                        />
                      </motion.div>

                      {/* Top Right - Pronunciation */}
                      <motion.div
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ 
                          x: 0, 
                          opacity: 1,
                          y: [0, 10, 0]
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardClick('pronunciation')}
                        transition={{ 
                          x: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.15 },
                          opacity: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.15 },
                          y: { duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.75 }
                        }}
                        className="absolute cursor-pointer"
                        style={{ 
                          left: '62%', 
                          top: '0%', 
                          width: '27%', 
                          height: '26%',
                          filter: glowingCard === 'pronunciation'
                            ? 'drop-shadow(0px 0px 15px hsl(var(--brand-blue)))'
                            : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      >
                        <div className="absolute" style={{ inset: '-11.96% -17.44% -20.65% -17.44%' }}>
                          <img 
                            src={progressPronunciation} 
                            alt="Pronunciation" 
                            className="block max-w-none h-full"
                          />
                        </div>
                      </motion.div>

                      {/* Center - Speak & New Words */}
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ 
                          y: [0, -6, 0], 
                          opacity: 1
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardClick('speak')}
                        transition={{ 
                          y: { duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
                          opacity: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.2 }
                        }}
                        className="absolute rounded-[16px] cursor-pointer"
                        style={{ 
                          left: '42%', 
                          top: '33%',
                          width: '56%',
                          height: '26%',
                          boxShadow: glowingCard === 'speak'
                            ? '0px 0px 20px 4px hsl(var(--brand-blue))'
                            : '0px 4px 15px 0px rgba(0,0,0,0.15)',
                          transition: 'box-shadow 0.3s ease'
                        }}
                      >
                        <img 
                          src={progressSpeakWords} 
                          alt="Speak and New words" 
                          className="absolute inset-0 w-full h-full object-contain bg-white/80 rounded-[16px]"
                        />
                      </motion.div>

                      {/* Bottom Left - CEFR Level */}
                      <motion.div
                        initial={{ x: -40, opacity: 0 }}
                        animate={{ 
                          x: 0, 
                          opacity: 1,
                          y: [0, 7, 0]
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardClick('cefr')}
                        transition={{ 
                          x: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.25 },
                          opacity: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.25 },
                          y: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.85 }
                        }}
                        className="absolute cursor-pointer"
                        style={{ 
                          left: '5%', 
                          top: '47%', 
                          width: '26%', 
                          height: '25%',
                          filter: glowingCard === 'cefr'
                            ? 'drop-shadow(0px 0px 15px hsl(var(--brand-blue)))'
                            : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      >
                        <div className="absolute" style={{ inset: '-12.22% -17.86% -21.11% -17.86%' }}>
                          <img 
                            src={progressCefrLevel} 
                            alt="CEFR Level" 
                            className="block max-w-none w-full h-full object-contain items-center"
                          />
                        </div>
                      </motion.div>

                      {/* Bottom Right - ML Score */}
                      <motion.div
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ 
                          x: 0, 
                          opacity: 1,
                          y: [0, -10, 0]
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardClick('ml')}
                        transition={{ 
                          x: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.3 },
                          opacity: { type: "spring", damping: 20, stiffness: 300, mass: 0.8, delay: 0.3 },
                          y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.9 }
                        }}
                        className="absolute cursor-pointer"
                        style={{ 
                          left: '46%', 
                          top: '61%', 
                          width: '48%',
                          height: '47%',
                          filter: glowingCard === 'ml'
                            ? 'drop-shadow(0px 0px 15px hsl(var(--brand-blue)))'
                            : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      >
                        <img 
                          src={progressMlScore} 
                          alt="ML score" 
                          className="block max-w-none w-full h-full object-contain"
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`card-set-${step.id}`}
                    className="space-y-4 flex flex-col justify-center h-full"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    {step.cards?.map((card, index) => (
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
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-pink-100 via-rose-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                              <card.icon className="w-7 h-7 text-rose-400" strokeWidth={2} />
                            </div>
                            {/* Text */}
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-gray-900 mb-0">
                                {card.title}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {card.desc}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        
        {/* Spacer */}
        <div className="flex-1 min-h-[32px]" />

        {/* Continue Button */}
        <div className="px-2 flex-shrink-0">
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
