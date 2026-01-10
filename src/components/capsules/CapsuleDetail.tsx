import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lock, Unlock, Calendar, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { toast } from "sonner";

interface CapsuleDetailProps {
  capsuleId: string;
  onBack: () => void;
}

export const CapsuleDetail = ({ capsuleId, onBack }: CapsuleDetailProps) => {
  const { user } = useAuth();
  const [capsule, setCapsule] = useState<DecryptedCapsule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCapsule = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const fetchedCapsule = await SecureCapsuleDB.getCapsule(capsuleId, user.uid);
        setCapsule(fetchedCapsule);
      } catch (error) {
        console.error('Error fetching capsule:', error);
        toast.error('Failed to load capsule');
      } finally {
        setLoading(false);
      }
    };

    fetchCapsule();
  }, [capsuleId, user]);

  const handleUnlock = async () => {
    if (!user || !capsule) return;

    try {
      await SecureCapsuleDB.unlockCapsule(capsuleId, user.uid);
      setCapsule(prev => prev ? { ...prev, isUnlocked: true } : null);
      toast.success('Capsule unlocked!');
    } catch (error) {
      console.error('Error unlocking capsule:', error);
      toast.error('Failed to unlock capsule');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!capsule) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">Capsule not found</h3>
            <p className="text-gray-600">This capsule may have been deleted or you don't have access to it.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUnlockable = new Date() >= capsule.unlockDate && !capsule.isUnlocked;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Memory Capsule</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-2xl">
                {capsule.isUnlocked ? (
                  <Unlock className="w-6 h-6 text-green-600" />
                ) : (
                  <Lock className="w-6 h-6 text-orange-600" />
                )}
                {capsule.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Created {format(capsule.createdAt, 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {capsule.isUnlocked 
                    ? `Unlocked ${formatDistanceToNow(capsule.unlockDate)} ago`
                    : `Unlocks ${format(capsule.unlockDate, 'MMM d, yyyy')}`
                  }
                </span>
              </CardDescription>
            </div>
            {isUnlockable && (
              <Button onClick={handleUnlock} className="bg-green-600 hover:bg-green-700">
                <Unlock className="w-4 h-4 mr-2" />
                Unlock Now
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {capsule.isUnlocked ? (
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {capsule.content}
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Lock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">This capsule is locked</h3>
              <p className="text-gray-600 mb-4">
                This memory will unlock on {format(capsule.unlockDate, 'MMMM d, yyyy')}
              </p>
              {isUnlockable && (
                <Button onClick={handleUnlock} className="bg-green-600 hover:bg-green-700">
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock Now
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};