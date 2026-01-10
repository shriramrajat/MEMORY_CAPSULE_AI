import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthView } from "@/components/auth/AuthView";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CreateCapsule } from "@/components/capsules/CreateCapsule";
import { CapsuleDetail } from "@/components/capsules/CapsuleDetail";

const Index = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'detail'>('dashboard');
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null);

  const handleViewChange = (view: typeof currentView, capsuleId?: string) => {
    setCurrentView(view);
    if (capsuleId) setSelectedCapsuleId(capsuleId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'dashboard' && (
        <Dashboard onViewChange={handleViewChange} />
      )}
      
      {currentView === 'create' && (
        <CreateCapsule onBack={() => setCurrentView('dashboard')} />
      )}
      
      {currentView === 'detail' && selectedCapsuleId && (
        <CapsuleDetail 
          capsuleId={selectedCapsuleId} 
          onBack={() => setCurrentView('dashboard')} 
        />
      )}
    </div>
  );
};

export default Index;