import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Star, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFreeTrial } from '@/hooks/useFreeTrial';
import { formatTimeRemaining } from '@/hooks/useVoiceTimeLimit';
import { cn } from '@/lib/utils';
import Cover1 from '@/assets/banner_activate.webp';

interface FreeTrialBannerProps {
  className?: string;
}

/**
 * Banner component shown to free trial users
 * 
 * Two variants:
 * - Unconfirmed email: Shows "Confirm your email" + "Activate Subscription" CTAs
 * - Confirmed email: Shows "Activate subscription" CTA only
 * 
 * Styled to match the pronunciation assessment card (image-background variant)
 */
export function FreeTrialBanner({ className }: FreeTrialBannerProps) {
  const navigate = useNavigate();
  const { isFreeTrial, isEmailConfirmed, voiceSecondsRemaining } = useFreeTrial();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if not in free trial or dismissed this session
  if (!isFreeTrial || isDismissed) {
    return null;
  }

  const handleConfirmEmail = () => {
    // Navigate to settings or show email confirmation resend
    navigate('/settings?tab=account');
  };

  const handleSeePlans = () => {
    navigate('/subscription-plans');
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const timeDisplay = formatTimeRemaining(voiceSecondsRemaining);

  return (
    <div className={cn(
      'relative overflow-hidden',
      className
    )}>
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${Cover1})` }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-between gap-4 p-4">
        {/* Main message */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isEmailConfirmed ? (
            <>
              <Star className="h-5 w-5 text-yellow-300 fill-yellow-300 flex-shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-sm text-white leading-tight">
                  Activate subscription to unlock full access
                </span>
                <div className="flex items-center gap-1 text-white/70 text-xs">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>{timeDisplay} free minutes remaining</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <Mail className="h-5 w-5 text-white/80 flex-shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-sm text-white leading-tight">
                  Confirm your email to unlock full access
                </span>
                <div className="flex items-center gap-1 text-white/70 text-xs">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>{timeDisplay} free minutes remaining</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* {!isEmailConfirmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConfirmEmail}
              className="text-white hover:bg-white/20 text-xs px-2 h-8"
            >
              Confirm Email
            </Button>
          )} */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSeePlans}
            className="bg-white text-gray-800 hover:bg-white text-xs font-medium px-3 h-8"
          >
            {isEmailConfirmed ? 'See Plans' : 'Activate'}
            <span className="ml-1">→</span>
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline banner for use in specific sections
 */
export function FreeTrialInlineBanner({ className }: FreeTrialBannerProps) {
  const navigate = useNavigate();
  const { isFreeTrial, voiceSecondsRemaining } = useFreeTrial();

  if (!isFreeTrial) {
    return null;
  }

  const timeDisplay = formatTimeRemaining(voiceSecondsRemaining);

  return (
    <div className={cn(
      'bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between',
      className
    )}>
      <div className="flex items-center gap-2 text-blue-700">
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">
          {timeDisplay} free minutes remaining
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/subscription-plans')}
        className="text-blue-600 border-blue-300 hover:bg-blue-100"
      >
        Upgrade
      </Button>
    </div>
  );
}
