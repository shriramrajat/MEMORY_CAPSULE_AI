
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Sparkles, Calendar, Heart, Lock, Unlock } from "lucide-react";
import { format, isAfter } from "date-fns";

interface Capsule {
  id: string;
  title: string;
  content: string;
  unlockDate: Date;
  createdAt: Date;
  isUnlocked: boolean;
  type: 'text' | 'image' | 'mixed';
  sentiment?: 'positive' | 'neutral' | 'negative';
}

interface DashboardProps {
  onViewChange: (view: 'create' | 'detail' | 'reflections', capsuleId?: string) => void;
}

export const Dashboard = ({ onViewChange }: DashboardProps) => {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [userName] = useState("Sarah"); // Will come from auth context

  useEffect(() => {
    // Mock data - replace with actual API calls
    const mockCapsules: Capsule[] = [
      {
        id: "1",
        title: "Letter to 2025 Me",
        content: "Dear future me, I hope you remember how hopeful I felt today...",
        unlockDate: new Date("2025-12-31"),
        createdAt: new Date("2024-01-15"),
        isUnlocked: false,
        type: 'text',
        sentiment: 'positive'
      },
      {
        id: "2", 
        title: "College Graduation Memories",
        content: "Today I graduated! I'm scared but excited about what's next...",
        unlockDate: new Date("2024-06-15"),
        createdAt: new Date("2023-06-15"),
        isUnlocked: true,
        type: 'mixed',
        sentiment: 'positive'
      },
      {
        id: "3",
        title: "New Year Resolutions",
        content: "This year I want to be kinder to myself and learn to paint...",
        unlockDate: new Date("2025-01-01"),
        createdAt: new Date("2024-01-01"),
        isUnlocked: false,
        type: 'text',
        sentiment: 'neutral'
      }
    ];

    // Check if any capsules should be unlocked
    const updatedCapsules = mockCapsules.map(capsule => ({
      ...capsule,
      isUnlocked: capsule.isUnlocked || isAfter(new Date(), capsule.unlockDate)
    }));

    setCapsules(updatedCapsules);
  }, []);

  const lockedCapsules = capsules.filter(c => !c.isUnlocked);
  const unlockedCapsules = capsules.filter(c => c.isUnlocked);

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-amber-600">
            <Clock className="h-8 w-8" />
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">
            Welcome back, {userName}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your personal time capsules are waiting. Create new memories for your future self
            or discover what past-you wanted to share.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Lock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">{lockedCapsules.length}</div>
              <div className="text-sm text-gray-600">Locked Capsules</div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Unlock className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">{unlockedCapsules.length}</div>
              <div className="text-sm text-gray-600">Unlocked Memories</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Heart className="h-8 w-8 text-pink-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">{capsules.length}</div>
              <div className="text-sm text-gray-600">Total Memories</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => onViewChange('create')}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-3 text-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create New Capsule
          </Button>
          
          <Button
            onClick={() => onViewChange('reflections')}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 px-8 py-3 text-lg"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            AI Reflections
          </Button>
        </div>

        {/* Capsules Grid */}
        <div className="space-y-8">
          {/* Unlocked Capsules */}
          {unlockedCapsules.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <Unlock className="h-6 w-6 mr-2 text-green-500" />
                Ready to Read
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unlockedCapsules.map((capsule) => (
                  <Card 
                    key={capsule.id}
                    className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => onViewChange('detail', capsule.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-gray-800">{capsule.title}</CardTitle>
                        <Badge className={getSentimentColor(capsule.sentiment)}>
                          {capsule.sentiment || 'neutral'}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-600">
                        Created {format(capsule.createdAt, 'MMM d, yyyy')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 text-sm line-clamp-3 mb-3">
                        {capsule.content}
                      </p>
                      <div className="flex items-center text-green-600 text-sm">
                        <Unlock className="h-4 w-4 mr-1" />
                        Unlocked
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Locked Capsules */}
          {lockedCapsules.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <Lock className="h-6 w-6 mr-2 text-amber-500" />
                Future Memories
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lockedCapsules.map((capsule) => (
                  <Card 
                    key={capsule.id}
                    className="border-0 shadow-lg bg-white/60 backdrop-blur-sm opacity-75"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-gray-700">{capsule.title}</CardTitle>
                        <Badge variant="secondary">
                          Locked
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-500">
                        Created {format(capsule.createdAt, 'MMM d, yyyy')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-amber-600 text-sm mb-2">
                        <Calendar className="h-4 w-4 mr-1" />
                        Unlocks {format(capsule.unlockDate, 'MMM d, yyyy')}
                      </div>
                      <div className="bg-gray-100 rounded p-3 text-gray-500 text-sm">
                        <Lock className="h-4 w-4 mx-auto mb-2" />
                        This memory is locked until {format(capsule.unlockDate, 'MMMM d, yyyy')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
