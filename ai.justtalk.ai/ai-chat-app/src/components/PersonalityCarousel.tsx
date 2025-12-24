import { useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue } from 'framer-motion';

interface Persona {
  name: string;
  tags: string;
  image: string;
}

const personas: Persona[] = [
  { name: 'Samantha', tags: 'Supportive · Encouraging', image: '/assets/interview_samantha.jpg' },
  { name: 'Brian', tags: 'Clear · Coaching', image: '/assets/interview_brian.jpg' },
  { name: 'Alina', tags: 'Warm · Patient', image: '/assets/Alina.jpg' },
  { name: 'Marcus', tags: 'Confident · Assertive', image: '/assets/interview_marcus.jpg' },
  { name: 'Mateo', tags: 'Casual · Friendly', image: '/assets/dating_mateo.jpg' },
  { name: 'Lucía', tags: 'Expressive · Engaging', image: '/assets/Lucia.jpeg' },
  { name: 'Imani', tags: 'Thoughtful · Curious', image: '/assets/Imani.jpeg' },
  { name: 'Naomi', tags: 'Professional · Polished', image: '/assets/Naomi.jpeg' },
  { name: 'Clara', tags: 'Calm · Supportive', image: '/assets/Clara.jpg' },
  { name: 'Andre', tags: 'Relaxed · Conversational', image: '/assets/dating_andre.jpg' },
  { name: 'Evan', tags: 'Analytical · Precise', image: '/assets/dating_evan.jpg' },
  { name: 'Julian', tags: 'Challenging · Sharp', image: '/assets/dating_julian.jpg' },
  { name: 'Noah', tags: 'Easygoing · Approachable', image: '/assets/dating_noah.jpg' },
  { name: 'Claire', tags: 'Analytical · Evaluative', image: '/assets/interview_claire.jpg' },
  { name: 'Steven', tags: 'Authoritative · Demanding', image: '/assets/interview_steven.jpg' },
];

// Split into two rows with different personas
const row1Personas = personas.slice(0, 8);
const row2Personas = personas.slice(8);

interface PersonaCardProps {
  persona: Persona;
}

function PersonaCard({ persona }: PersonaCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-[32px] p-1 shadow-md w-[160px] flex-shrink-0">
      <div className="relative h-[160px] w-full rounded-[28px] overflow-hidden flex items-end p-2">
        <img
          src={persona.image}
          alt={persona.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative bg-white rounded-2xl px-3 py-1.5 w-full z-10">
          <p className="font-semibold text-black mb-0 text-xs leading-tight">{persona.name}</p>
          <p className="font-normal text-black/75 text-[9px] leading-tight">{persona.tags}</p>
        </div>
      </div>
    </div>
  );
}

interface ScrollingRowProps {
  personas: Persona[];
  direction?: 'left' | 'right';
  offset?: number;
}

function ScrollingRow({ personas, direction = 'left', offset = 0 }: ScrollingRowProps) {
  const x = useMotionValue(offset);
  const controls = useAnimation();
  const isDragging = useRef(false);
  const cardWidth = 160 + 16; // card width + gap
  const totalWidth = personas.length * cardWidth;

  useEffect(() => {
    const animateScroll = async () => {
      if (isDragging.current) return;

      const currentX = x.get();
      const targetX = direction === 'left' ? -totalWidth : totalWidth;
      
      await controls.start({
        x: [currentX, currentX + targetX],
        transition: {
          duration: 40,
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
        duration: 40,
        ease: 'linear',
        repeat: Infinity,
      },
    });
  };

  // Duplicate personas for infinite scroll effect
  const duplicatedPersonas = [...personas, ...personas, ...personas];

  return (
    <div className="relative overflow-hidden w-full py-0 max-w-full">
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
        {duplicatedPersonas.map((persona, index) => (
          <PersonaCard key={`${persona.name}-${index}`} persona={persona} />
        ))}
      </motion.div>
    </div>
  );
}

export function PersonalityCarousel() {
  return (
    <div className="flex flex-col gap-4 w-full overflow-hidden max-w-full">
      <ScrollingRow personas={row1Personas} direction="left" offset={0} />
      <ScrollingRow personas={row2Personas} direction="left" offset={-80} />
    </div>
  );
}
