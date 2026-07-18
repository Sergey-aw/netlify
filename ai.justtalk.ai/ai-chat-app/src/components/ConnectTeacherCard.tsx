import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

/**
 * Student-facing card: enter a teacher's referral code to connect accounts.
 * Uses the shared `redeem_teacher_referral_code` RPC (same backend as web/iOS),
 * which creates the teacher_student_links row idempotently.
 */
function referralErrorMessage(raw?: string | null): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('cannot_redeem_own')) return "You can't redeem your own referral code.";
  if (m.includes('invalid_code')) return "That referral code isn't valid.";
  if (m.includes('not_authenticated')) return 'Please sign in first, then apply the code.';
  return "Couldn't apply the referral code. Please try again.";
}

export default function ConnectTeacherCard() {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onApply = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('redeem_teacher_referral_code', {
        p_code: normalized,
      });
      if (error) throw error;
      const teacherName = (data as { teacher_name?: string } | null)?.teacher_name ?? 'your teacher';
      toast({ title: 'Connected!', description: `You're now connected with ${teacherName}.` });
      setCode('');
    } catch (err: any) {
      toast({ title: "Couldn't connect", description: referralErrorMessage(err?.message), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-1">Connect with a teacher</h3>
      <p className="text-xs text-gray-500 mb-3">
        Have a referral code from your teacher? Enter it to connect.
      </p>
      <form onSubmit={onApply} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 3C9LP9LE"
          className="font-mono tracking-widest"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Referral code"
        />
        <Button type="submit" disabled={submitting || !code.trim()}>
          {submitting ? 'Connecting…' : 'Apply'}
        </Button>
      </form>
    </Card>
  );
}
