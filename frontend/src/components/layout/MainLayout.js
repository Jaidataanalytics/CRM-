import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { FilterBar } from '@/components/filters/FilterBar';
import { Toaster } from '@/components/ui/sonner';

export const MainLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <FilterBar />
        <main className="flex-1 overflow-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};
