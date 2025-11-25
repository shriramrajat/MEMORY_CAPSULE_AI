
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus, Sparkles, Calendar, Heart, Lock, Unlock, AlertCircle, Search, GitBranch, User, Settings, Download, CheckSquare, Square, X, Bell } from "lucide-react";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { NotificationService, NotificationData } from "@/lib/notification-service";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DashboardProps {
  onViewChange: (view: 'create' | 'detail' | 'reflections' | 'search' | 'timeline' | 'profile' | 'settings', capsuleId?: string) => void;
}

export const Dashboard = ({ onViewChange }: DashboardProps) => {
  const [capsules, setCapsules] = useState<DecryptedCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCapsules, setSelectedCapsules] = useState<Set<string>>(new Set());
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [newlyUnlockedCapsules, setNewlyUnlockedCapsules] = useState<DecryptedCapsule[]>([]);
  const [showUnlockBanner, setShowUnlockBanner] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { user, userKey } = useAuth();
  const userName = user?.email?.split('@')[0] || "User";

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
        setCapsules(fetchedCapsules);

        // Check for newly unlocked capsules and send notifications
        try {
          const newlyUnlockedIds = await NotificationService.checkAndNotifyUnlocks(
            user.id,
            fetchedCapsules.map(c => ({
              id: c.id,
              title: c.title,
              unlockDate: c.unlockDate,
              isUnlocked: c.isUnlocked
            }))
          );

          // If there are newly unlocked capsules, show banner
          if (newlyUnlockedIds.length > 0) {
            const unlockedCapsules = fetchedCapsules.filter(c => 
              newlyUnlockedIds.includes(c.id)
            );
            setNewlyUnlockedCapsules(unlockedCapsules);
            setShowUnlockBanner(true);
          }
        } catch (notificationError) {
          console.error('Error checking unlock notifications:', notificationError);
          // Don't fail the whole dashboard if notifications fail
        }

        // Fetch pending notifications
        try {
          const pendingNotifications = await NotificationService.getPendingNotifications(user.id);
          setNotifications(pendingNotifications);
        } catch (notificationError) {
          console.error('Error fetching notifications:', notificationError);
          // Don't fail the whole dashboard if notifications fail
        }
      } catch (err) {
        console.error('Error fetching capsules:', err);
        setError('Failed to load your capsules. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchCapsules();
  }, [user, userKey]);

  const lockedCapsules = capsules.filter(c => !c.isUnlocked);
  const unlockedCapsules = capsules.filter(c => c.isUnlocked);

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleCapsuleSelection = (capsuleId: string) => {
    const newSelection = new Set(selectedCapsules);
    if (newSelection.has(capsuleId)) {
      newSelection.delete(capsuleId);
    } else {
      newSelection.add(capsuleId);
    }
    setSelectedCapsules(newSelection);
  };

  const selectAllCapsules = () => {
    const allIds = new Set(capsules.map(c => c.id));
    setSelectedCapsules(allIds);
  };

  const deselectAllCapsules = () => {
    setSelectedCapsules(new Set());
  };

  const handleBulkExport = async () => {
    if (selectedCapsules.size === 0) {
      toast.error('No capsules selected', {
        description: 'Please select at least one capsule to export'
      });
      return;
    }

    if (!user || !userKey) {
      toast.error('Authentication required', {
        description: 'Please log in to export capsules'
      });
      return;
    }

    try {
      setExportProgress(0);
      
      const capsuleIds = Array.from(selectedCapsules);
      const zipBlob = await SecureCapsuleDB.bulkExportCapsules(
        capsuleIds,
        user.id,
        userKey,
        (progress) => setExportProgress(progress)
      );

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `memory-capsules-export-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export complete', {
        description: `Successfully exported ${selectedCapsules.size} capsule${selectedCapsules.size > 1 ? 's' : ''}`
      });

      // Reset selection mode
      setSelectionMode(false);
      setSelectedCapsules(new Set());
    } catch (err) {
      console.error('Bulk export failed:', err);
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Failed to export capsules. Please try again.'
      });
    } finally {
      setExportProgress(null);
    }
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    try {
      // Mark as read
      await NotificationService.markAsRead(notification.id);
      
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      
      // Navigate to capsule if applicable
      if (notification.capsuleId) {
        setNotificationOpen(false);
        onViewChange('detail', notification.capsuleId);
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Mark all notifications as read
      await Promise.all(
        notifications.map(notification => 
          NotificationService.markAsRead(notification.id)
        )
      );
      
      // Clear local state
      setNotifications([]);
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const unreadCount = notifications.length;

  // Loading state with skeleton screens
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header Skeleton */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <Skeleton className="h-10 w-64 mx-auto" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>

          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 text-center space-y-2">
                  <Skeleton className="h-8 w-8 mx-auto rounded-full" />
                  <Skeleton className="h-8 w-16 mx-auto" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons Skeleton */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full sm:w-40" />
            ))}
          </div>

          {/* Capsules Grid Skeleton */}
          <div className="space-y-8">
            <div>
              <Skeleton className="h-8 w-48 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Unlock Notification Banner */}
        {showUnlockBanner && newlyUnlockedCapsules.length > 0 && (
          <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Unlock className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <AlertTitle className="text-green-800 font-semibold">
                    {newlyUnlockedCapsules.length === 1 
                      ? 'A Memory Has Unlocked! 🎉' 
                      : `${newlyUnlockedCapsules.length} Memories Have Unlocked! 🎉`}
                  </AlertTitle>
                  <AlertDescription className="text-green-700 mt-1">
                    {newlyUnlockedCapsules.length === 1 ? (
                      <>
                        Your capsule <strong>"{newlyUnlockedCapsules[0].title}"</strong> is now ready to read.
                      </>
                    ) : (
                      <>
                        You have {newlyUnlockedCapsules.length} capsules ready to read:{' '}
                        {newlyUnlockedCapsules.map((c, i) => (
                          <span key={c.id}>
                            <strong>"{c.title}"</strong>
                            {i < newlyUnlockedCapsules.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </>
                    )}
                  </AlertDescription>
                  <div className="mt-3 flex gap-2">
                    {newlyUnlockedCapsules.map((capsule) => (
                      <Button
                        key={capsule.id}
                        onClick={() => onViewChange('detail', capsule.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Read "{capsule.title}"
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnlockBanner(false)}
                className="text-green-600 hover:text-green-800 hover:bg-green-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {/* Header */}
        <div className="text-center space-y-4 relative">
          {/* Notification Bell - positioned absolutely in top right */}
          <div className="absolute top-0 right-0">
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative"
                  data-testid="notification-bell"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      variant="destructive"
                      data-testid="notification-badge"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="text-xs h-auto py-1 px-2"
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[400px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Bell className="h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No notifications</p>
                      <p className="text-xs text-gray-400 mt-1">
                        You're all caught up!
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                          data-testid={`notification-item-${notification.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {notification.type === 'unlock' && (
                                <Unlock className="h-5 w-5 text-green-600" />
                              )}
                              {notification.type === 'reminder' && (
                                <Clock className="h-5 w-5 text-blue-600" />
                              )}
                              {notification.type === 'system' && (
                                <AlertCircle className="h-5 w-5 text-gray-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 mb-1">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mb-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

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
            onClick={() => onViewChange('timeline')}
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50 px-8 py-3 text-lg"
          >
            <GitBranch className="h-5 w-5 mr-2" />
            View Timeline
          </Button>
          
          <Button
            onClick={() => onViewChange('search')}
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50 px-8 py-3 text-lg"
          >
            <Search className="h-5 w-5 mr-2" />
            Search Memories
          </Button>
          
          <Button
            onClick={() => onViewChange('reflections')}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 px-8 py-3 text-lg"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            AI Reflections
          </Button>
          
          <Button
            onClick={() => onViewChange('profile')}
            variant="outline"
            className="border-amber-200 text-amber-700 hover:bg-amber-50 px-8 py-3 text-lg"
          >
            <User className="h-5 w-5 mr-2" />
            Profile
          </Button>
          
          <Button
            onClick={() => onViewChange('settings')}
            variant="outline"
            className="border-gray-200 text-gray-700 hover:bg-gray-50 px-8 py-3 text-lg"
          >
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </Button>
        </div>

        {/* Bulk Export Section */}
        {capsules.length > 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Download className="h-5 w-5 mr-2 text-blue-600" />
                  Bulk Export
                </span>
                {!selectionMode ? (
                  <Button
                    onClick={() => setSelectionMode(true)}
                    variant="outline"
                    size="sm"
                  >
                    Select Capsules
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={selectAllCapsules}
                      variant="outline"
                      size="sm"
                    >
                      Select All
                    </Button>
                    <Button
                      onClick={deselectAllCapsules}
                      variant="outline"
                      size="sm"
                    >
                      Deselect All
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedCapsules(new Set());
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                {selectionMode 
                  ? `${selectedCapsules.size} capsule${selectedCapsules.size !== 1 ? 's' : ''} selected`
                  : 'Export multiple capsules with all their files as a ZIP archive'
                }
              </CardDescription>
            </CardHeader>
            {selectionMode && (
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    onClick={handleBulkExport}
                    disabled={selectedCapsules.size === 0 || exportProgress !== null}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export {selectedCapsules.size > 0 ? `${selectedCapsules.size} ` : ''}Selected
                  </Button>
                </div>
                {exportProgress !== null && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Creating ZIP archive...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

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
                    className={`border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 ${
                      selectionMode ? 'cursor-pointer' : 'cursor-pointer'
                    } ${
                      selectedCapsules.has(capsule.id) ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleCapsuleSelection(capsule.id);
                      } else {
                        onViewChange('detail', capsule.id);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {selectionMode && (
                            selectedCapsules.has(capsule.id) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )
                          )}
                          <CardTitle className="text-lg text-gray-800">{capsule.title}</CardTitle>
                        </div>
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
                    className={`border-0 shadow-lg bg-white/60 backdrop-blur-sm opacity-75 ${
                      selectionMode ? 'cursor-pointer' : ''
                    } ${
                      selectedCapsules.has(capsule.id) ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleCapsuleSelection(capsule.id);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {selectionMode && (
                            selectedCapsules.has(capsule.id) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )
                          )}
                          <CardTitle className="text-lg text-gray-700">{capsule.title}</CardTitle>
                        </div>
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
