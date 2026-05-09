import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface VoiceBarsProps {
  levels: number[];
  isActive: boolean;
  color?: 'blue' | 'green';
  size?: 'sm' | 'md';
}

export function VoiceBars({ levels, isActive, color = 'blue', size = 'sm' }: VoiceBarsProps) {
  const barCount = size === 'sm' ? 5 : 8;
  const displayLevels = levels.length > 0 ? levels.slice(0, barCount) : Array(barCount).fill(0.2);
  
  const heightClass = size === 'sm' ? 'h-4' : 'h-6';
  const widthClass = size === 'sm' ? 'w-0.5' : 'w-1';
  
  const colorClass = color === 'blue' 
    ? 'bg-blue-500' 
    : 'bg-green-500';

  return (
    <div className={cn('flex items-center gap-0.5', heightClass)}>
      {displayLevels.map((level, i) => (
        <motion.div
          key={i}
          className={cn(
            widthClass,
            'rounded-full transition-colors',
            isActive ? colorClass : 'bg-gray-300'
          )}
          animate={{
            height: isActive ? `${level * 100}%` : '20%',
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 20,
          }}
        />
      ))}
    </div>
  );
}
