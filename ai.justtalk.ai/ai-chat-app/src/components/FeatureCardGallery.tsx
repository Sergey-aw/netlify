import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic } from 'lucide-react';
import Cover1 from '../assets/Cover-1.png';
import Cover2 from '../assets/Cover-2.png';
import Cover3 from '../assets/Cover-3.png';
import Cover4 from '../assets/Cover-4.png';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface FeatureCardGalleryProps {
  onNavigate: (route: string) => void;
}

const cards = [
  {
    id: 'free-talk',
    title: 'Free Talk',
    description: '⁠Speak about anything you want. Pause, restart, make mistakes — I’ll help you keep going and sound more natural.',
    cta: 'Start conversation →',
    route: '/ai-chat/voice/new',
    coverImage: Cover1,
  },
  {
    id: 'scenarios',
    title: 'Role Plays',
    description: 'Practice real conversations — dating, interviews, travel, and more. Some scenarios continue over time, letting conversations evolve naturally.',
    cta: 'Browse scenarios →',
    route: '/role-plays',
    coverImage: Cover2,
  },
  {
    id: 'my-words',
    title: 'My Words',
    description: 'The words you use. The words you’re learning next.',
    cta: 'Your vocabulary, evolving →',
    route: '/dictionary',
    coverImage: Cover3,
  },
  {
    id: 'profile',
    title: 'Profile',
    description: 'Your account, preferences, and learning history — all in one place.',
    cta: 'View profile →',
    route: '/profile',
    coverImage: Cover4,
  },
];

export function FeatureCardGallery({ onNavigate }: FeatureCardGalleryProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    // Set initial slide
    setCurrentIndex(carouselApi.selectedScrollSnap());

    // Listen for slide changes
    carouselApi.on('select', () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  return (
    <div className="w-full touch-pan-x" data-swipe-ignore="true">
      <Carousel
        opts={{
          align: 'center',
          loop: false,
          containScroll: false,
        }}
        setApi={setCarouselApi}
        className="w-full touch-pan-x"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {cards.map((card, index) => {
            // Calculate scale and opacity for spring entrance effect
            const distance = Math.abs(index - currentIndex);

            return (
              <CarouselItem key={card.id} className="pl-2 basis-[85%]">
                <motion.div
                  className="relative w-full h-[330px] rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => onNavigate(card.route)}
                  whileTap={{ scale: 0.98 }}
                  animate={{
                    scale: index === currentIndex ? 1 : 0.95,
                    opacity: distance > 0 ? 0.6 : 1,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 250,
                    damping: 30,
                    mass: 0.8,
                  }}
                >
                  {/* Background Image */}
                  <img
                    src={card.coverImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />

                  {/* Content */}
                  <div className="relative h-full flex flex-col justify-end p-6">
                    {/* Icon */}
                    <div className="flex justify-center mb-auto pt-8">
                      <div className="w-[52px] h-[52px] flex items-center justify-center">
                        <Mic className="w-full h-full text-white" strokeWidth={1.5} />
                      </div>
                    </div>

                    {/* Text Content */}
                    <div>
                      <h3 className="text-2xl font-medium text-white">
                        {card.title}
                      </h3>
                      <p className="text-base text-white/85 leading-tight mb-6">
                        {card.description}
                      </p>
                      <p className="text-base font-medium text-white text-right">
                        {card.cta}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Dot Indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => carouselApi?.scrollTo(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'w-8 bg-slate-400'
                : 'w-2 bg-slate-400/20'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
