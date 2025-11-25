import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, Unlock, ZoomIn, ZoomOut, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TimelineProps {
  onCapsuleClick: (capsuleId: string) => void;
  onBack: () => void;
}

export const Timeline = ({ onCapsuleClick, onBack }: TimelineProps) => {
  const [capsules, setCapsules] = useState<DecryptedCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);
  const { user, userKey } = useAuth();

  useEffect(() => {
    const fetchCapsules = async () => {
      if (!user || !userKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Fetch capsules from Firebase
        const fetchedCapsules = await SecureCapsuleDB.getUserCapsules(user.id, userKey);
        
        // Sort capsules chronologically by creation date
        const sortedCapsules = [...fetchedCapsules].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );
        
        setCapsules(sortedCapsules);
      } catch (err) {
        console.error('Error fetching capsules:', err);
        setError('Failed to load your capsules. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchCapsules();
  }, [user, userKey]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getSentimentColor = (sentiment?: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500 border-green-600';
      case 'negative':
        return 'bg-red-500 border-red-600';
      case 'neutral':
      default:
        return 'bg-blue-500 border-blue-600';
    }
  };

  const getStatusIndicator = (isUnlocked: boolean) => {
    if (isUnlocked) {
      return (
        <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1 border-2 border-white shadow-lg">
          <Unlock className="h-4 w-4 text-white" />
        </div>
      );
    }
    return (
      <div className="absolute -top-2 -right-2 bg-amber-500 rounded-full p-1 border-2 border-white shadow-lg">
        <Lock className="h-4 w-4 text-white" />
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-amber-600 mx-auto" />
          <p className="text-gray-600">Loading your timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={onBack}
              variant="outline"
              className="border-gray-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-gray-800">Memory Timeline</h1>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleZoomOut}
              variant="outline"
              size="sm"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              onClick={handleZoomIn}
              variant="outline"
              size="sm"
              disabled={zoom >= 2}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {capsules.length === 0 && !loading && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <p className="text-gray-600 text-lg">
                No capsules yet. Create your first memory to see it on the timeline!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Timeline Container */}
        {capsules.length > 0 && (
          <div 
            ref={timelineRef}
            className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-8"
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab',
              minHeight: '600px'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Timeline Line */}
            <div 
              className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-300 via-blue-300 to-purple-300"
              style={{
                transform: `translateX(-50%) translateX(${panOffset.x}px)`
              }}
            />

            {/* Timeline Items */}
            <div 
              className="relative space-y-12"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center top',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              {capsules.map((capsule, index) => {
                const isLeft = index % 2 === 0;
                
                return (
                  <div 
                    key={capsule.id}
                    className={`flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'} gap-8`}
                  >
                    {/* Capsule Card */}
                    <div className={`w-5/12 ${isLeft ? 'text-right' : 'text-left'}`}>
                      <Card 
                        className={`
                          border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer
                          ${getSentimentColor(capsule.sentiment)}
                          ${capsule.isUnlocked ? 'bg-white' : 'bg-white/60 opacity-90'}
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCapsuleClick(capsule.id);
                        }}
                        style={{ position: 'relative' }}
                      >
                        {getStatusIndicator(capsule.isUnlocked)}
                        
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg text-gray-800">
                              {capsule.title}
                            </CardTitle>
                            {capsule.sentiment && (
                              <Badge 
                                className={
                                  capsule.sentiment === 'positive' 
                                    ? 'bg-green-100 text-green-800'
                                    : capsule.sentiment === 'negative'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }
                              >
                                {capsule.sentiment}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-gray-600">
                            {format(capsule.createdAt, 'MMMM d, yyyy')}
                          </CardDescription>
                        </CardHeader>
                        
                        <CardContent>
                          <p className="text-gray-700 text-sm line-clamp-2 mb-2">
                            {capsule.content}
                          </p>
                          <div className={`flex items-center text-sm ${
                            capsule.isUnlocked ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {capsule.isUnlocked ? (
                              <>
                                <Unlock className="h-4 w-4 mr-1" />
                                Unlocked
                              </>
                            ) : (
                              <>
                                <Lock className="h-4 w-4 mr-1" />
                                Unlocks {format(capsule.unlockDate, 'MMM d, yyyy')}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Timeline Dot */}
                    <div className="relative flex-shrink-0">
                      <div 
                        className={`
                          w-6 h-6 rounded-full border-4 border-white shadow-lg z-10
                          ${getSentimentColor(capsule.sentiment)}
                        `}
                      />
                    </div>

                    {/* Empty Space on Other Side */}
                    <div className="w-5/12" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        {capsules.length > 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 text-center">
                Click on any capsule to view details • Use zoom controls to adjust view • Drag to pan around the timeline
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
