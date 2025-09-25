// src/app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-card border-r p-4">
        <h2 className="text-lg font-semibold">Cosmic Raid</h2>
        {/* Sidebar navigation will go here */}
      </aside>
      <main className="flex-1 p-6 bg-background">
        {children}
      </main>
    </div>
  );
}