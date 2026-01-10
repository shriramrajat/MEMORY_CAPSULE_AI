import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Plus, Lock, Unlock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { toast } from "sonner";

interface DashboardProps {
  onViewChange: (view: 'create' | 'detail', capsuleId?: string) => void;
}

export const Dashboard = ({ onViewChange }: DashboardProps) => {
  const [capsules, setCapsules] = useState<DecryptedCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCapsules = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const fetchedCapsules = await SecureCapsuleDB.getUserCapsules(user.uid);
        setCapsules(fetchedCapsules);
      } catch (error) {
        console.error('Error fetching capsules:', error);
        toast.error('Failed to load capsules');
      } finally {
        setLoading(false);
      }
    };

    fetchCapsules();
  }, [user]);

  const handleDeleteCapsule = async (capsuleId: string) => {
    if (!user) return;
    
    try {
      await SecureCapsuleDB.deleteCapsule(capsuleId, user.uid);
      setCapsules(prev => prev.filter(c => c.id !== capsuleId));
      toast.success('Capsule deleted successfully');
    } catch (error) {
      console.error('Error deleting capsule:', error);
      toast.error('Failed to delete capsule');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Memory Capsules</h1>
        <Button onClick={() => onViewChange('create')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Capsule
        </Button>
      </div>

      {capsules.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No capsules yet</h3>
            <p className="text-gray-600 mb-4">Create your first memory capsule to get started</p>
            <Button onClick={() => onViewChange('create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Capsule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {capsules.map((capsule) => (
            <Card key={capsule.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {capsule.isUnlocked ? (
                        <Unlock className="w-4 h-4 text-green-600" />
                      ) : (
                        <Lock className="w-4 h-4 text-orange-600" />
                      )}
                      {capsule.title}
                    </CardTitle>
                    <CardDescription>
                      Created {format(capsule.createdAt, 'MMM d, yyyy')} • 
                      Unlocks {format(capsule.unlockDate, 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewChange('detail', capsule.id)}
                    >
                      View
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCapsule(capsule.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 line-clamp-2">
                  {capsule.isUnlocked ? capsule.content : "This capsule is locked until its unlock date."}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};