import { useEffect, useState } from 'react';
import { AudioWaveform } from 'lucide-react';

interface VoiceButtonTransitionProps {
  isTransitioning: boolean;
  startPosition?: { x: number; y: number };
  onTransitionComplete?: () => void;
}

export function VoiceButtonTransition({
  isTransitioning,
  startPosition,
  onTransitionComplete,
}: VoiceButtonTransitionProps) {
  const [stage, setStage] = useState<'start' | 'morphing' | 'complete'>('start');

  useEffect(() => {
    if (isTransitioning && startPosition) {
      // Start morphing immediately
      requestAnimationFrame(() => {
        setStage('morphing');
      });
      
      // Complete after animation
      const timer = setTimeout(() => {
        setStage('complete');
        onTransitionComplete?.();
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setStage('start');
    }
  }, [isTransitioning, startPosition, onTransitionComplete]);

  if (!isTransitioning || !startPosition || stage === 'complete') return null;

  const isMorphing = stage === 'morphing';

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Background fade */}
      <div 
        className="absolute inset-0 bg-background transition-opacity duration-300"
        style={{ opacity: isMorphing ? 1 : 0 }}
      />
      
      {/* Morphing button */}
      <div
        className="absolute bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-500 ease-out"
        style={{
          left: isMorphing ? '50%' : `${startPosition.x}px`,
          top: isMorphing ? '50%' : `${startPosition.y}px`,
          width: isMorphing ? '120px' : '52px',
          height: isMorphing ? '120px' : '40px',
          transform: isMorphing ? 'translate(-50%, -50%)' : 'none',
        }}
      >
        <AudioWaveform 
          className="transition-all duration-500" 
          style={{ 
            width: isMorphing ? '48px' : '20px',
            height: isMorphing ? '48px' : '20px',
          }} 
        />
      </div>
    </div>
  );
}
