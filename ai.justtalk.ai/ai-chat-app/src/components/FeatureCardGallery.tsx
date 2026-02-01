import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, MessageSquareHeart, BookOpen, AudioLines, UserCircle } from 'lucide-react';
import Cover1 from '../assets/Cover-7.jpg';
import Cover2 from '../assets/Cover-2.png';
import Cover4 from '../assets/Cover-4.png';
import Cover5 from '../assets/Cover-5.jpg';
import Cover6 from '../assets/Cover-6.jpg';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { FeatureCardGrid } from './FeatureCardGrid';

interface FeatureCardGalleryProps {
  onNavigate: (route: string) => void;
}

const cards = [
  
  {
    id: 'scenarios',
    title: 'Role Plays',
    description: 'Practice real conversations — dating, interviews, travel, and more. Some scenarios continue over time, letting conversations evolve naturally.',
    cta: 'Browse scenarios →',
    route: '/role-plays',
    coverImage: Cover5,
    icon: MessageSquareHeart,
  },
    {
    id: 'pronunciation',
    title: 'Pronunciation Assessment',
    description: 'Evaluate your pronunciation skills with personalized feedback and targeted practice recommendations.',
    cta: 'Start assessment →',
    route: '/pronunciation-practice',
    coverImage: Cover6,
    icon: AudioLines,
  },
  {
    id: 'free-talk',
    title: 'Free Talk',
    description: '⁠Speak about anything you want. Pause, restart, make mistakes — I’ll help you keep going and sound more natural.',
    cta: 'Start conversation →',
    route: '/ai-chat/voice/new',
    coverImage: Cover2,    
    icon: Mic,  
  },
  {
    id: 'my-words',
    title: 'My Words',
    description: 'The words you use. The words you’re learning next.',
    cta: 'Your vocabulary, evolving →',
    route: '/dictionary',
    coverImage: Cover1,    icon: BookOpen,  },
  {
    id: 'profile',
    title: 'Profile',
    description: 'Your account, preferences, and learning history — all in one place.',
    cta: 'View profile →',
    route: '/profile',
    coverImage: Cover4,
    icon: UserCircle,
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
    <div className="w-full">
      {/* Mobile Carousel */}
      <div className="md:hidden w-full touch-pan-x" data-swipe-ignore="true">
        <Carousel
          opts={{
            align: 'center',
            loop: false,
            containScroll: false,
          }}
          setApi={setCarouselApi}
          className="w-full touch-pan-x"
        >
          <CarouselContent className="-ml-2">
            {cards.map((card, index) => {
              // Calculate scale and opacity for spring entrance effect
              const distance = Math.abs(index - currentIndex);

              return (
                <CarouselItem key={card.id} className="pl-2 basis-[85%]">
                  <motion.div
                    className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-pointer"
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
                    <div className="relative h-full flex flex-col justify-between p-6">
                      {/* Icon */}
                      <div className="flex justify-center h-full items-center mb-auto">
                        <div className="w-[40px] h-[40px] flex items-center justify-center">
                          <card.icon className="w-full h-full text-white" strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Text Content */}
                      <div>
                        <h3 className="text-xl font-medium text-white mb-3 text-left">
                          {card.title}
                        </h3>
                        <p className="text-base text-white/85 leading-snug mb-6 text-left">
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

      {/* Desktop Grid */}
      <div className="hidden md:block">
        <FeatureCardGrid cards={cards} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
