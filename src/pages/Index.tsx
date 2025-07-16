
import { useState } from "react";
import { AuthView } from "@/components/auth/AuthView";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CreateCapsule } from "@/components/capsules/CreateCapsule";
import { CapsuleDetail } from "@/components/capsules/CapsuleDetail";
import { AiReflections } from "@/components/ai/AiReflections";

const Index = () => {
  const [currentView, setCurrentView] = useState<'auth' | 'dashboard' | 'create' | 'detail' | 'reflections'>('auth');
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleViewChange = (view: typeof currentView, capsuleId?: string) => {
    setCurrentView(view);
    if (capsuleId) setSelectedCapsuleId(capsuleId);
  };

  const handleAuthentication = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    if (authenticated) setCurrentView('dashboard');
  };

  if (!isAuthenticated) {
    return <AuthView onAuthenticated={handleAuthentication} />;
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
