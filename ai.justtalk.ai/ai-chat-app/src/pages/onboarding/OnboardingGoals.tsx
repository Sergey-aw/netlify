import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { learningGoals } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { updateOnboardingStep } from '@/lib/onboarding-state';

export default function OnboardingGoals() {
  const navigate = useNavigate();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.goals) {
      setSelectedGoals(saved.goals);
    }
  }, []);

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  };

  const handleContinue = () => {
    if (selectedGoals.length > 0) {
      // Save to localStorage
      const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
      saved.goals = selectedGoals;
      localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));
      
      // Update onboarding state
      updateOnboardingStep('onboarding-interests');
      
      navigate('/onboarding/interests');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress Indicator */}
      <div className="px-4 py-6">
        <div className="flex gap-1.5 mb-4">
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
          <div className="h-1 flex-1 bg-gray-200 rounded-full" />
          <div className="h-1 flex-1 bg-gray-200 rounded-full" />
        </div>
        <p className="text-sm text-gray-500">Step 1 of 3</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          What are your
          <br />
          learning goals?
        </h1>
        <p className="text-gray-600 mb-8">
          Select one or more to personalize your AI teacher
        </p>

        {/* Goals Grid */}
        <div className="grid grid-cols-2 gap-3">
          {learningGoals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={cn(
                'relative p-4 rounded-2xl border-2 transition-all text-left',
                selectedGoals.includes(goal.id)
                  ? 'border-blue-500 bg-blue-50 shadow-lg scale-95'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {/* Checkmark */}
              {selectedGoals.includes(goal.id) && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3',
                  goal.gradient
                )}
              >
                <span className="text-2xl">{goal.icon}</span>
              </div>

              {/* Text */}
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{goal.title}</h3>
              <p className="text-xs text-gray-500">{goal.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-4 pb-8">
        <Button
          onClick={handleContinue}
          disabled={selectedGoals.length === 0}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
