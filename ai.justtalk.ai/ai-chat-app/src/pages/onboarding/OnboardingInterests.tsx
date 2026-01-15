import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { interestCategories } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep } from '@/lib/posthog';

export default function OnboardingInterests() {
  const navigate = useNavigate();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    trackOnboardingStep('interests', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.interests) {
      setSelectedInterests(saved.interests);
    }
  }, []);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleContinue = () => {
    if (selectedInterests.length > 0) {
      // Save to localStorage
      const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
      saved.interests = selectedInterests;
      localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));
      
      // Track completion
      trackOnboardingStep('interests', 'completed', { 
        interests_selected: selectedInterests.length,
        interests: selectedInterests 
      });
      
      // Update onboarding state
      updateOnboardingStep('onboarding-preferences');
      
      navigate('/onboarding/preferences');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress Indicator */}
      <div className="px-4 py-6">
        <div className="flex gap-1.5 mb-4">
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
          <div className="h-1 flex-1 bg-gray-200 rounded-full" />
        </div>
        <p className="text-sm text-gray-500">Step 2 of 3</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 overflow-y-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          What are you
          <br />
          interested in?
        </h1>
        <p className="text-gray-600 mb-8">
          Choose topics you'd like to discuss with your AI teacher
        </p>

        {/* Interests by Category */}
        <div className="space-y-6">
          {Object.entries(interestCategories).map(([category, interests]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                {category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium transition-all',
                      selectedInterests.includes(interest)
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {interest}
                    {selectedInterests.includes(interest) && (
                      <Check className="inline-block w-4 h-4 ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-4 pb-8">
        <Button
          onClick={handleContinue}
          disabled={selectedInterests.length === 0}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
