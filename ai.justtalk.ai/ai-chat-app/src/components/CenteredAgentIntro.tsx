import { motion } from 'motion/react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface CenteredAgentIntroProps {
  agentName: string;
  agentDescription?: string;
  agentImageUrl?: string;
}

export function CenteredAgentIntro({ 
  agentName, 
  agentDescription, 
  agentImageUrl 
}: CenteredAgentIntroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex-1 flex flex-col items-center justify-center px-8"
    >
      {/* Agent Avatar */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mb-6"
      >
        <Avatar className="w-32 h-32 shadow-xl">
          <AvatarImage src={agentImageUrl} />
          <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
            🤖
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {/* Agent Name */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-3xl font-bold text-center mb-3"
      >
        {agentName}
      </motion.h1>

      {/* Agent Description */}
      {agentDescription && (
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center text-muted-foreground text-lg mb-8 max-w-md"
        >
          {agentDescription}
        </motion.p>
      )}

      {/* Connecting Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="flex items-center gap-3 text-muted-foreground"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Connecting to voice chat...</span>
      </motion.div>
    </motion.div>
  );
}
