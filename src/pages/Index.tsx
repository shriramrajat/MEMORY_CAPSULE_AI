
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthView } from "@/components/auth/AuthView";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CreateCapsule } from "@/components/capsules/CreateCapsule";
import { CapsuleDetail } from "@/components/capsules/CapsuleDetail";
import { AiReflections } from "@/components/ai/AiReflections";

const Index = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'detail' | 'reflections'>('dashboard');
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null);

  const handleViewChange = (view: typeof currentView, capsuleId?: string) => {
    setCurrentView(view);
    if (capsuleId) setSelectedCapsuleId(capsuleId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your secure capsules...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50">
      {currentView === 'dashboard' && (
        <Dashboard onViewChange={handleViewChange} />
      )}
      {currentView === 'create' && (
        <CreateCapsule onBack={() => handleViewChange('dashboard')} />
      )}
      {currentView === 'detail' && selectedCapsuleId && (
        <CapsuleDetail 
          capsuleId={selectedCapsuleId} 
          onBack={() => handleViewChange('dashboard')} 
        />
      )}
      {currentView === 'reflections' && (
        <AiReflections onBack={() => handleViewChange('dashboard')} />
      )}
    </div>
  );
};

export default Index;
