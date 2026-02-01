import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface Card {
  id: string;
  title: string;
  description: string;
  cta: string;
  route: string;
  coverImage: string;
  icon: LucideIcon;
}

interface FeatureCardGridProps {
  cards: Card[];
  onNavigate: (route: string) => void;
}

export function FeatureCardGrid({ cards, onNavigate }: FeatureCardGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 px-4">
      {cards.map((card) => (
        <motion.div
          key={card.id}
          className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer bg-slate-200 hover:bg-gradient-to-br group transition-all duration-300"
          onClick={() => onNavigate(card.route)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Hover Background Overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <img
              src={card.coverImage}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>

          {/* Content */}
          <div className="relative h-full flex flex-col justify-between p-6 lg:p-4">
            {/* Icon */}
            <div className="flex justify-center pt-14 lg:justify-start lg:pt-0 lg:mb-auto">
              <div className="w-[52px] h-[52px] lg:w-8 lg:h-8 flex items-center justify-center">
                <card.icon 
                  className="w-full h-full text-gray-900 group-hover:text-white transition-colors duration-300" 
                  strokeWidth={1.5} 
                />
              </div>
            </div>

            {/* Text Content */}
            <div>
              <h3 className="text-xl lg:text-base font-medium text-gray-900 group-hover:text-white mb-3 lg:mb-1.5 text-left transition-colors duration-300">
                {card.title}
              </h3>
              <p className="text-base lg:text-sm text-gray-700 group-hover:text-white/85 leading-snug mb-6 lg:mb-0 text-left transition-colors duration-300">
                {card.description}
              </p>
              <p className="text-base font-medium text-gray-900 group-hover:text-white text-right transition-colors duration-300 lg:hidden">
                {card.cta}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
