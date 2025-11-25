
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthView } from "@/components/auth/AuthView";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CreateCapsule } from "@/components/capsules/CreateCapsule";
import { CapsuleDetail } from "@/components/capsules/CapsuleDetail";
import { AiReflections } from "@/components/ai/AiReflections";
import { Search } from "@/components/search/Search";
import { Timeline } from "@/components/timeline/Timeline";
import { Profile } from "@/components/profile/Profile";
import { Settings } from "@/components/settings/Settings";
import { useToast } from "@/hooks/use-toast";
import FeatureErrorBoundary from "@/components/FeatureErrorBoundary";

const Index = () => {
  const { user, loading, sessionExpired, intendedDestination, setIntendedDestination, clearSessionExpired } = useAuth();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'detail' | 'reflections' | 'search' | 'timeline' | 'profile' | 'settings'>('dashboard');
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null);

  const handleViewChange = (view: typeof currentView, capsuleId?: string) => {
    setCurrentView(view);
    if (capsuleId) setSelectedCapsuleId(capsuleId);
  };

  // Handle session expiration
  useEffect(() => {
    if (sessionExpired && !user) {
      // Store the current view as intended destination before redirecting to login
      const destination = currentView !== 'dashboard' ? currentView : null;
      if (destination) {
        setIntendedDestination(destination);
      }
      
      // Display session expired message
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please sign in again.",
        variant: "destructive",
      });
      
      clearSessionExpired();
    }
  }, [sessionExpired, user, currentView, setIntendedDestination, clearSessionExpired, toast]);

  // Redirect to intended destination after successful login
  useEffect(() => {
    if (user && intendedDestination) {
      // Redirect to the intended destination
      setCurrentView(intendedDestination as typeof currentView);
      
      // Clear the intended destination
      setIntendedDestination(null);
      
      toast({
        title: "Welcome back!",
        description: "Redirecting to your previous page...",
      });
    }
  }, [user, intendedDestination, setIntendedDestination, toast]);

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
        <FeatureErrorBoundary featureName="Dashboard">
          <Dashboard onViewChange={handleViewChange} />
        </FeatureErrorBoundary>
      )}
      {currentView === 'create' && (
        <FeatureErrorBoundary 
          featureName="Create Capsule" 
          onBack={() => handleViewChange('dashboard')}
        >
          <CreateCapsule onBack={() => handleViewChange('dashboard')} />
        </FeatureErrorBoundary>
      )}
      {currentView === 'detail' && selectedCapsuleId && (
        <FeatureErrorBoundary 
          featureName="Capsule Detail" 
          onBack={() => handleViewChange('dashboard')}
        >
          <CapsuleDetail 
            capsuleId={selectedCapsuleId} 
            onBack={() => handleViewChange('dashboard')} 
          />
        </FeatureErrorBoundary>
      )}
      {currentView === 'reflections' && (
        <FeatureErrorBoundary 
          featureName="AI Reflections" 
          onBack={() => handleViewChange('dashboard')}
        >
          <AiReflections onBack={() => handleViewChange('dashboard')} />
        </FeatureErrorBoundary>
      )}
      {currentView === 'search' && (
        <FeatureErrorBoundary 
          featureName="Search" 
          onBack={() => handleViewChange('dashboard')}
        >
          <Search 
            onCapsuleSelect={(capsuleId) => handleViewChange('detail', capsuleId)}
            onBack={() => handleViewChange('dashboard')} 
          />
        </FeatureErrorBoundary>
      )}
      {currentView === 'timeline' && (
        <FeatureErrorBoundary 
          featureName="Timeline" 
          onBack={() => handleViewChange('dashboard')}
        >
          <Timeline 
            onCapsuleClick={(capsuleId) => handleViewChange('detail', capsuleId)}
            onBack={() => handleViewChange('dashboard')} 
          />
        </FeatureErrorBoundary>
      )}
      {currentView === 'profile' && (
        <FeatureErrorBoundary 
          featureName="Profile" 
          onBack={() => handleViewChange('dashboard')}
        >
          <Profile onBack={() => handleViewChange('dashboard')} />
        </FeatureErrorBoundary>
      )}
      {currentView === 'settings' && (
        <FeatureErrorBoundary 
          featureName="Settings" 
          onBack={() => handleViewChange('dashboard')}
        >
          <Settings onBack={() => handleViewChange('dashboard')} />
        </FeatureErrorBoundary>
      )}
    </div>
  );
};

export default Index;
