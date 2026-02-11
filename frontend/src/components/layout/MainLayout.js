import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, SidebarContext } from './Sidebar';
import { Header } from './Header';
import { FilterBar } from '@/components/filters/FilterBar';
import { Toaster } from '@/components/ui/sonner';

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <FilterBar />
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 bg-background">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-right" />
      </div>
    </SidebarContext.Provider>
  );
};
