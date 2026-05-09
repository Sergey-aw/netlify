import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const languages = [
  { code: 'es', flag: '🇪🇸', name: 'Spanish', native: 'español' },
  { code: 'pt', flag: '🇧🇷', name: 'Portuguese', native: 'português' },
  { code: 'fr', flag: '🇫🇷', name: 'French', native: 'français' },
  { code: 'de', flag: '🇩🇪', name: 'German', native: 'Deutsch' },
  { code: 'it', flag: '🇮🇹', name: 'Italian', native: 'italiano' },
  { code: 'ru', flag: '🇷🇺', name: 'Russian', native: 'русский' },
  { code: 'pl', flag: '🇵🇱', name: 'Polish', native: 'polski' },
  { code: 'nl', flag: '🇳🇱', name: 'Dutch', native: 'Nederlands' },
  { code: 'sv', flag: '🇸🇪', name: 'Swedish', native: 'svenska' },
  { code: 'da', flag: '🇩🇰', name: 'Danish', native: 'dansk' },
  { code: 'fi', flag: '🇫🇮', name: 'Finnish', native: 'suomi' },
  { code: 'no', flag: '🇳🇴', name: 'Norwegian', native: 'norsk' },
  { code: 'el', flag: '🇬🇷', name: 'Greek', native: 'ελληνικά' },
  { code: 'tr', flag: '🇹🇷', name: 'Turkish', native: 'Türkçe' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese', native: '中文' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese', native: '日本語' },
  { code: 'ko', flag: '🇰🇷', name: 'Korean', native: '한국어' },
  { code: 'th', flag: '🇹🇭', name: 'Thai', native: 'ไทย' },
  { code: 'vi', flag: '🇻🇳', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'id', flag: '🇮🇩', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ms', flag: '🇲🇾', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', flag: '🇧🇩', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', flag: '🇮🇳', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', flag: '🇮🇳', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ar', flag: '🇸🇦', name: 'Arabic', native: 'العربية' },
  { code: 'he', flag: '🇮🇱', name: 'Hebrew', native: 'עברית' },
  { code: 'fa', flag: '🇮🇷', name: 'Persian', native: 'فارسی' },
  { code: 'ur', flag: '🇵🇰', name: 'Urdu', native: 'اردو' },
  { code: 'en', flag: '🇬🇧', name: 'English', native: 'English' },
];

const TOTAL_STEPS = 15;
const CURRENT_STEP = 2;

export default function OnboardingNativeLanguage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    trackOnboardingStep('native-language', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.nativeLanguage) {
      const lang = languages.find(l => l.name === saved.nativeLanguage || l.code === saved.nativeLanguage);
      setSelected(lang?.code || saved.nativeLanguage);
    }
  }, []);

  const handleSelect = (code: string) => {
    setSelected(code);

    const lang = languages.find(l => l.code === code);
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.nativeLanguage = lang?.name || code;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('native-language', 'completed', { native_language: lang?.name || code });

    setTimeout(() => navigate('/onboarding/speaking-confidence'), 200);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 overflow-y-auto pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          What is your native language?
        </h1>

        <div className="space-y-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left',
                selected === lang.code
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="font-medium text-gray-900">
                {lang.name} <span className="text-gray-400">· {lang.native}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
