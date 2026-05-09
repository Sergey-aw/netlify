import { cn } from '@/lib/utils';

interface ActivationDotsProps {
  count: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ActivationDots({ 
  count, 
  max = 3, 
  className,
  size = 'md'
}: ActivationDotsProps) {
  const dotCount = Math.min(count, max);
  
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-colors",
            sizeClasses[size],
            i < dotCount 
              ? "bg-[hsl(var(--brand-blue))]" 
              : "bg-gray-200 dark:bg-gray-700"
          )}
          aria-label={i < dotCount ? "Used" : "Not used"}
        />
      ))}
    </div>
  );
}
