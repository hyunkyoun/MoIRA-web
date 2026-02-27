import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnalysisDesign from '@/components/AnalysisDesign';

export const metadata = { title: 'Analysis Design | MoIRA' };

export default async function AnalysisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');
  return <AnalysisDesign userId={user.id} />;
}
