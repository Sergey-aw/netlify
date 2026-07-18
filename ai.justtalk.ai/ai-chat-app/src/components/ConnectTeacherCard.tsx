import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

/**
 * Student-facing card: shows the teachers this student is connected to (via the
 * shared get_my_teachers RPC) and, in the same card, an input to connect to
 * another teacher with a referral code (redeem_teacher_referral_code RPC).
 * Same backend as the web + iOS apps.
 */
interface ConnectedTeacher {
  id: string;
  name: string;
  avatar_url: string | null;
}

function referralErrorMessage(raw?: string | null): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('cannot_redeem_own')) return "You can't redeem your own referral code.";
  if (m.includes('invalid_code')) return "That referral code isn't valid.";
  if (m.includes('not_authenticated')) return 'Please sign in first, then apply the code.';
  return "Couldn't apply the referral code. Please try again.";
}

export default function ConnectTeacherCard() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['my-teachers'],
    queryFn: async (): Promise<ConnectedTeacher[]> => {
      const { data, error } = await supabase.rpc('get_my_teachers');
      if (error) throw error;
      return (data ?? []) as ConnectedTeacher[];
    },
  });

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
      qc.invalidateQueries({ queryKey: ['my-teachers'] });
    } catch (err: any) {
      toast({ title: "Couldn't connect", description: referralErrorMessage(err?.message), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-1">Your teachers</h3>
      <p className="text-xs text-gray-500 mb-3">Teachers you're connected with, and how to add another.</p>

      {/* Connected teachers */}
      {isLoading ? (
        <p className="text-sm text-gray-500 mb-4">Loading…</p>
      ) : teachers.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {teachers.map((t) => (
            <li key={t.id} className="flex items-center gap-3">
              {t.avatar_url ? (
                <img src={t.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium">{t.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mb-4">You're not connected with a teacher yet.</p>
      )}

      {/* Connect with a code */}
      <div className="border-t pt-3">
        <p className="text-sm font-medium mb-1">Connect with a teacher</p>
        <p className="text-xs text-gray-500 mb-2">Have a referral code? Enter it to connect.</p>
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
      </div>
    </Card>
  );
}
