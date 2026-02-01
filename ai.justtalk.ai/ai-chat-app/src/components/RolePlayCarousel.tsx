import { useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';
import { 
  MessageCircle, 
  Coffee, 
  Users, 
  Heart, 
  MessageSquare,
  Briefcase,
  FileText,
  Handshake,
  Plane,
  ShoppingCart,
  BookOpen,
  type LucideIcon
} from 'lucide-react';

interface RolePlay {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const rolePlays: RolePlay[] = [
  // Core conversation
  { title: 'Free Conversation', description: 'Open-ended conversation', icon: MessageCircle, color: 'bg-blue-100/70' },
  { title: 'Small Talk', description: 'Short, casual exchanges', icon: Coffee, color: 'bg-purple-100/70' },
  { title: 'Social Situations', description: 'Everyday social interactions', icon: Users, color: 'bg-pink-100/70' },
  
  // Dating & relationships
  { title: 'Dating', description: 'Getting to know someone', icon: Heart, color: 'bg-rose-100/70' },
  { title: 'Deep Conversations', description: 'Sharing opinions and feelings', icon: MessageSquare, color: 'bg-red-100/70' },
  
  // Professional & high-pressure
  { title: 'Job Interview', description: 'Answering interview questions', icon: Briefcase, color: 'bg-indigo-100/70' },
  { title: 'Work Conversations', description: 'Discussing tasks and ideas', icon: FileText, color: 'bg-cyan-100/70' },
  { title: 'Networking', description: 'Introducing yourself professionally', icon: Handshake, color: 'bg-teal-100/70' },
  
  // Practical real-world use
  { title: 'Travel', description: 'Asking for help and information', icon: Plane, color: 'bg-sky-100/70' },
  { title: 'Daily Life', description: 'Common day-to-day situations', icon: ShoppingCart, color: 'bg-amber-100/70' },
  
  // Guided learning
  { title: 'Skill Practice', description: 'Learn a language pattern through conversation', icon: BookOpen, color: 'bg-emerald-100/70' },
];

// Split into 4 rows with different counts for asymmetry
const row1RolePlays = rolePlays.slice(0, 3);  // 3 items
const row2RolePlays = rolePlays.slice(3, 5);  // 2 items
const row3RolePlays = rolePlays.slice(5, 8);  // 3 items
const row4RolePlays = rolePlays.slice(8);     // 3 items

interface RolePlayCardProps {
  rolePlay: RolePlay;
}

function RolePlayCard({ rolePlay }: RolePlayCardProps) {
  const Icon = rolePlay.icon;
  
  return (
    <div className="bg-white border border-gray-100 rounded-3xl shadow-md flex-shrink-0 flex items-center" 
         style={{ 
           padding: 'clamp(0.375rem, 2vw, 0.5rem)',
           gap: 'clamp(0.5rem, 2.5vw, 0.625rem)'
         }}>
      <div className={`${rolePlay.color} rounded-[18px] flex items-center justify-center flex-shrink-0`}
           style={{
             width: 'clamp(48px, 15vw, 60px)',
             height: 'clamp(48px, 15vw, 60px)'
           }}>
        <Icon className="text-gray-700" strokeWidth={2}
              style={{ width: 'clamp(20px, 6vw, 24px)', height: 'clamp(20px, 6vw, 24px)' }} />
      </div>
      <div style={{ paddingRight: 'clamp(0.5rem, 3vw, 0.75rem)' }}>
        <p className="font-medium text-black mb-0 leading-tight text-[clamp(0.75rem,3.5vw,0.875rem)]">{rolePlay.title}</p>
        <p className="font-normal text-black/75 leading-tight text-[clamp(0.625rem,3vw,0.75rem)]">{rolePlay.description}</p>
      </div>
    </div>
  );
}

interface ScrollingRowProps {
  rolePlays: RolePlay[];
  direction?: 'left' | 'right';
  offset?: number;
}

function ScrollingRow({ rolePlays, direction = 'left', offset = 0 }: ScrollingRowProps) {
  const x = useMotionValue(offset);
  const controls = useAnimation();
  const isDragging = useRef(false);
  const cardWidth = 240; // approximate card width
  const gap = 16;
  const totalWidth = rolePlays.length * (cardWidth + gap);

  useEffect(() => {
    const animateScroll = async () => {
      if (isDragging.current) return;

      const currentX = x.get();
      const targetX = direction === 'left' ? -totalWidth : totalWidth;
      
      await controls.start({
        x: [currentX, currentX + targetX],
        transition: {
          duration: 35,
          ease: 'linear',
          repeat: Infinity,
        },
      });
    };

    animateScroll();
  }, [controls, direction, totalWidth, x]);

  const handleDragStart = () => {
    isDragging.current = true;
    controls.stop();
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    const currentX = x.get();
    
    // Resume animation from current position
    controls.start({
      x: [currentX, currentX + (direction === 'left' ? -totalWidth : totalWidth)],
      transition: {
        duration: 35,
        ease: 'linear',
        repeat: Infinity,
      },
    });
  };

  // Duplicate rolePlays for infinite scroll effect
  const duplicatedRolePlays = [...rolePlays, ...rolePlays, ...rolePlays];

  return (
    <div className="relative w-full py-1 max-w-full overflow-hidden">
      <motion.div
        className="flex gap-4"
        drag="x"
        dragConstraints={{ left: -totalWidth, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
      >
        {duplicatedRolePlays.map((rolePlay, index) => (
          <RolePlayCard key={`${rolePlay.title}-${index}`} rolePlay={rolePlay} />
        ))}
      </motion.div>
    </div>
  );
}

export function RolePlayCarousel() {
  return (
    <div className="flex flex-col gap-2 w-full overflow-hidden max-w-full">
      <ScrollingRow rolePlays={row1RolePlays} direction="left" offset={0} />
      <ScrollingRow rolePlays={row2RolePlays} direction="left" offset={-60} />
      <ScrollingRow rolePlays={row3RolePlays} direction="left" offset={-120} />
      <ScrollingRow rolePlays={row4RolePlays} direction="left" offset={-40} />
    </div>
  );
}
