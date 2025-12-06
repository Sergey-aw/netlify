import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cefrLevels, voiceOptions } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { markOnboardingComplete } from '@/lib/onboarding-state';

export default function OnboardingPreferences() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cefrLevel, setCefrLevel] = useState('');
  const [voicePreference, setVoicePreference] = useState('');
  const [correctionStyle, setCorrectionStyle] = useState('balanced');

  // Load from database on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('cefr_level, justai_correction_style')
        .eq('id', user.id)
        .single();
      
      if (data?.cefr_level) setCefrLevel(data.cefr_level);
      if (data?.justai_correction_style) setCorrectionStyle(data.justai_correction_style);
    };
    loadPreferences();
  }, [user]);

  const correctionStyles = [
    {
      id: 'gentle',
      name: 'Gentle',
      description: 'Minimal corrections, focus on encouragement',
      icon: '🌸',
    },
    {
      id: 'balanced',
      name: 'Balanced',
      description: 'Helpful corrections without overwhelming',
      icon: '⚖️',
    },
    {
      id: 'strict',
      name: 'Strict',
      description: 'Detailed corrections for faster improvement',
      icon: '📚',
    },
  ];

  const handleComplete = async () => {
    if (!cefrLevel || !voicePreference) return;

    try {
      // Save to localStorage first
      const onboardingData = {
        cefrLevel,
        correctionStyle,
      };
      localStorage.setItem('justai_onboarding_preferences', JSON.stringify(onboardingData));

      // If user is authenticated, save to database
      if (user) {
        // Get current profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('learning_goals, interests')
          .eq('id', user.id)
          .single();

        // Update profile with preferences and mark onboarding complete
        await supabase
          .from('profiles')
          .update({
            cefr_level: cefrLevel,
            justai_correction_style: correctionStyle,
            justai_onboarding_completed: true,
          })
          .eq('id', user.id);

        // Create or update agent config
        await supabase
          .from('justai_agent_configs')
          .upsert({
            student_id: user.id,
            learning_goals: profile?.learning_goals || [],
            interests: profile?.interests || [],
            cefr_level: cefrLevel,
            correction_style: correctionStyle,
            system_prompt_template: 'default',
            onboarding_completed: true,
          });
      }

      // Mark onboarding as complete in state
      markOnboardingComplete();

      // Redirect to subscription plans (paywall) regardless of auth status
      navigate('/subscription-plans');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-y-auto">
      {/* Progress Indicator */}
      <div className="px-4 py-6">
        <div className="flex gap-1.5 mb-4">
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
        </div>
        <p className="text-sm text-gray-500">Step 3 of 3</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Final touches
        </h1>
        <p className="text-gray-600 mb-8">
          Help us personalize your learning experience
        </p>

        {/* English Level */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Your English Level</h3>
          <div className="space-y-2">
            {cefrLevels.map((level) => (
              <button
                key={level.level}
                onClick={() => setCefrLevel(level.level)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 transition-all text-left',
                  cefrLevel === level.level
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {level.level} - {level.name}
                    </p>
                    <p className="text-sm text-gray-600">{level.description}</p>
                  </div>
                  {cefrLevel === level.level && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Voice Preference */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Choose AI Voice</h3>
          <div className="grid grid-cols-2 gap-3">
            {voiceOptions.map((voice) => (
              <button
                key={voice.id}
                onClick={() => setVoicePreference(voice.id)}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all text-left relative',
                  voicePreference === voice.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <p className="font-semibold text-gray-900">{voice.name}</p>
                <p className="text-xs text-gray-500">
                  {voice.accent} • {voice.gender}
                </p>
                <p className="text-xs text-gray-600 mt-1">{voice.description}</p>
                <button className="absolute top-3 right-3 p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                  <Play className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Correction Style */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Correction Style</h3>
          <div className="space-y-2">
            {correctionStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => setCorrectionStyle(style.id)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 transition-all text-left',
                  correctionStyle === style.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{style.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{style.name}</p>
                    <p className="text-sm text-gray-600">{style.description}</p>
                  </div>
                  {correctionStyle === style.id && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <Button
          onClick={handleComplete}
          disabled={!cefrLevel || !voicePreference}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
