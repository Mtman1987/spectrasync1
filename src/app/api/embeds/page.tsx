// src/app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getAdminInfo, getGuildDetails } from '@/app/actions';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.adminId) {
    // If there's no session, send them back to the login page.
    redirect('/');
  }

  const { value: adminData } = await getAdminInfo(session.adminId);

  if (!adminData) {
    // This could happen if the admin document was deleted.
    // We'll log them out and send them to the login page with an error.
    session.destroy();
    redirect('/?error=Admin profile not found. Please log in again.');
  }

  const selectedGuildId = adminData.selectedGuild || adminData.discordUserGuilds?.[0]?.id;
  const guild = selectedGuildId ? await getGuildDetails(selectedGuildId) : null;

  return (
    <h1 className="text-2xl font-bold">Welcome, {adminData.discordInfo.username}!</h1>
  );
}