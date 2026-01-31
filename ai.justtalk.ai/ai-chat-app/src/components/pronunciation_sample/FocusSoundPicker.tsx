/**
 * Phase 8.4: Focus Sound Picker Modal
 * Allows users to select exactly 2 phonemes from the candidates list
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IPAPracticeCandidate } from './hooks/useIPAPracticeCandidates';

const MAX_SELECTIONS = 2;

interface FocusSoundPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: IPAPracticeCandidate[];
  currentTargets: string[];
  onConfirm: (targets: string[]) => void;
}

export function FocusSoundPicker({
  open,
  onOpenChange,
  candidates,
  currentTargets,
  onConfirm,
}: FocusSoundPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(currentTargets)
  );

  // Reset selection when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelected(new Set(currentTargets));
    }
    onOpenChange(isOpen);
  };

  const toggleSelection = (ipaSymbol: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ipaSymbol)) {
        next.delete(ipaSymbol);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(ipaSymbol);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size === MAX_SELECTIONS) {
      onConfirm(Array.from(selected));
      onOpenChange(false);
    }
  };

  const selectedCount = selected.size;
  const canConfirm = selectedCount === MAX_SELECTIONS;

  // Group candidates by severity
  const { critical, warning } = useMemo(() => {
    const critical: IPAPracticeCandidate[] = [];
    const warning: IPAPracticeCandidate[] = [];
    
    candidates.forEach(c => {
      if (c.severity_bucket === 'critical') {
        critical.push(c);
      } else {
        warning.push(c);
      }
    });
    
    return { critical, warning };
  }, [candidates]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose Practice Sounds</DialogTitle>
          <DialogDescription>
            Select exactly 2 sounds to practice. Your session will focus on these.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto">
          {/* Selection Counter */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">
              Selected: {selectedCount} / {MAX_SELECTIONS}
            </span>
            {selectedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Critical Sounds */}
          {critical.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-700 dark:text-red-400">
                  Critical
                </Badge>
                <span className="text-muted-foreground font-normal">
                  ({critical.length} sounds)
                </span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {critical.map(candidate => (
                  <SoundPickerTile
                    key={candidate.ipa_symbol}
                    candidate={candidate}
                    isSelected={selected.has(candidate.ipa_symbol)}
                    isDisabled={!selected.has(candidate.ipa_symbol) && selectedCount >= MAX_SELECTIONS}
                    onClick={() => toggleSelection(candidate.ipa_symbol)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Warning Sounds */}
          {warning.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                  Warning
                </Badge>
                <span className="text-muted-foreground font-normal">
                  ({warning.length} sounds)
                </span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {warning.map(candidate => (
                  <SoundPickerTile
                    key={candidate.ipa_symbol}
                    candidate={candidate}
                    isSelected={selected.has(candidate.ipa_symbol)}
                    isDisabled={!selected.has(candidate.ipa_symbol) && selectedCount >= MAX_SELECTIONS}
                    onClick={() => toggleSelection(candidate.ipa_symbol)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {candidates.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No sounds need practice right now. Complete calibration to identify areas for improvement.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {canConfirm 
              ? 'Confirm Selection'
              : `Select ${MAX_SELECTIONS - selectedCount} more`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SoundPickerTileProps {
  candidate: IPAPracticeCandidate;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

function SoundPickerTile({ candidate, isSelected, isDisabled, onClick }: SoundPickerTileProps) {
  const isCritical = candidate.severity_bucket === 'critical';
  const displayScore = Math.round(candidate.avg_score || 0);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isSelected
          ? "border-primary bg-primary/10"
          : isDisabled
            ? "border-muted bg-muted/20 opacity-50 cursor-not-allowed"
            : isCritical
              ? "border-red-200 bg-red-50 hover:border-red-400 dark:border-red-800 dark:bg-red-950/30 dark:hover:border-red-600"
              : "border-amber-200 bg-amber-50 hover:border-amber-400 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:border-amber-600"
      )}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* IPA Symbol */}
      <span className="font-mono text-xl font-semibold">
        {candidate.ipa_symbol}
      </span>

      {/* Score */}
      <span
        className={cn(
          "text-sm font-medium mt-1",
          isCritical
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {displayScore}%
      </span>
    </button>
  );
}
