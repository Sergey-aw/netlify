import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cefrLevels } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/lib/auth';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep, trackOnboardingCompleted } from '@/lib/posthog';

interface Voice {
  voice_id: string;
  name: string;
  labels: {
    gender: string;
    accent: string;
    age?: string;
    use_case?: string;
  };
  preview_url: string;
  is_primary: boolean;
}

export default function OnboardingPreferences() {
  const navigate = useNavigate();
  const [cefrLevel, setCefrLevel] = useState('');
  const [voicePreference, setVoicePreference] = useState('');
  const [correctionStyle, setCorrectionStyle] = useState('balanced');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load voices from API
  useEffect(() => {
    trackOnboardingStep('preferences', 'started');
    const loadVoices = async () => {
      try {
        // Ensure we have a session for the API call
        await ensureAnonymousSession();

        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-get-voices`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices || []);
          const primaryVoice = data.voices.find((v: Voice) => v.is_primary);
          if (primaryVoice) {
            setVoicePreference(primaryVoice.voice_id);
          }
        }
      } catch (error) {
        console.error('Error loading voices:', error);
      } finally {
        setLoadingVoices(false);
      }
    };
    loadVoices();

    // Load saved preferences from localStorage
    const saved = localStorage.getItem('justai_onboarding_preferences');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.cefrLevel) setCefrLevel(data.cefrLevel);
        if (data.correctionStyle) setCorrectionStyle(data.correctionStyle);
      } catch {}
    }
  }, []);

  // Play voice preview
  const handlePlayVoice = (voiceId: string, previewUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (playingVoice === voiceId) {
      // Stop current audio
      audioRef.current?.pause();
      setPlayingVoice(null);
    } else {
      // Stop any existing audio
      audioRef.current?.pause();
      
      // Play new audio
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      setPlayingVoice(voiceId);
      
      audio.play();
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
    }
  };

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
      // Save all preferences to localStorage for later DB sync after signup
      const onboardingData = {
        cefrLevel,
        correctionStyle,
        voicePreference,
      };
      localStorage.setItem('justai_onboarding_preferences', JSON.stringify(onboardingData));

      // Update onboarding state
      updateOnboardingStep('email-entry');

      // Track completion
      trackOnboardingStep('preferences', 'completed', {
        cefr_level: cefrLevel,
        correction_style: correctionStyle,
        voice_id: voicePreference,
      });
      trackOnboardingCompleted({
        cefr_level: cefrLevel,
        correction_style: correctionStyle,
        voice_id: voicePreference,
      });

      // Navigate to signup
      navigate('/login');
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
          {loadingVoices ? (
            <div className="text-center py-8 text-gray-500">Loading voices...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {voices.map((voice) => (
                <button
                  key={voice.voice_id}
                  onClick={() => setVoicePreference(voice.voice_id)}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-left relative',
                    voicePreference === voice.voice_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className="font-semibold text-gray-900">
                    {voice.name}
                    {voicePreference === voice.voice_id && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                        Active
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {voice.labels.accent} • {voice.labels.gender}
                  </p>
                  {voice.labels.age && (
                    <p className="text-xs text-gray-600 mt-1 capitalize">
                      {voice.labels.age.replace('_', ' ')}
                    </p>
                  )}
                  <button
                    onClick={(e) => handlePlayVoice(voice.voice_id, voice.preview_url, e)}
                    className="absolute top-3 right-3 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {playingVoice === voice.voice_id ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>
                </button>
              ))}
            </div>
          )}
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
