import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Mail, Calendar, Package, Unlock, FileText, Loader2, AlertCircle, Edit2, Save, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { collection, query, where, getDocs, getCountFromServer, doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/integrations/firebase/config";
import { updateProfile } from "firebase/auth";
import { toast } from "sonner";

interface ProfileProps {
  onBack: () => void;
}

interface AccountStatistics {
  totalCapsules: number;
  unlockedCapsules: number;
  totalFiles: number;
}

export const Profile = ({ onBack }: ProfileProps) => {
  const { user, refreshUser } = useAuth();
  const [statistics, setStatistics] = useState<AccountStatistics>({
    totalCapsules: 0,
    unlockedCapsules: 0,
    totalFiles: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | undefined>();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        // Fetch user document from Firestore
        const userDocRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDisplayName(userData.display_name || '');
        } else {
          // If user document doesn't exist, use Firebase Auth display name
          setDisplayName(auth.currentUser?.displayName || '');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    const fetchStatistics = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch total capsules count
        const capsulesQuery = query(
          collection(db, 'capsules'),
          where('user_id', '==', user.id)
        );
        const capsulesSnapshot = await getCountFromServer(capsulesQuery);
        const totalCapsules = capsulesSnapshot.data().count;

        // Fetch unlocked capsules count
        const unlockedQuery = query(
          collection(db, 'capsules'),
          where('user_id', '==', user.id),
          where('is_unlocked', '==', true)
        );
        const unlockedSnapshot = await getCountFromServer(unlockedQuery);
        const unlockedCapsules = unlockedSnapshot.data().count;

        // Fetch total files count
        const filesQuery = query(
          collection(db, 'capsule_files'),
          where('user_id', '==', user.id)
        );
        const filesSnapshot = await getCountFromServer(filesQuery);
        const totalFiles = filesSnapshot.data().count;

        setStatistics({
          totalCapsules,
          unlockedCapsules,
          totalFiles,
        });
      } catch (err) {
        console.error('Error fetching account statistics:', err);
        setError('Failed to load account statistics. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [user]);

  const handleSaveDisplayName = async () => {
    if (!user) return;
    
    // Validate display name
    if (!displayName.trim()) {
      setDisplayNameError('Display name cannot be empty');
      toast.error('Display name cannot be empty');
      return;
    }
    
    if (displayName.trim().length < 2) {
      setDisplayNameError('Display name must be at least 2 characters');
      toast.error('Display name must be at least 2 characters');
      return;
    }
    
    if (displayName.trim().length > 50) {
      setDisplayNameError('Display name must be less than 50 characters');
      toast.error('Display name must be less than 50 characters');
      return;
    }

    try {
      setIsSaving(true);
      setDisplayNameError(undefined);

      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
        });
      }

      // Update or create user document in Firestore
      const userDocRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // Update existing document
        await setDoc(userDocRef, {
          display_name: displayName.trim(),
        }, { merge: true });
      } else {
        // Create new document
        await setDoc(userDocRef, {
          user_id: user.id,
          email: user.email,
          display_name: displayName.trim(),
          created_at: new Date(user.created_at),
          last_login: new Date(),
          preferences: {
            theme: 'auto',
            notifications_enabled: false,
            email_notifications: false,
          },
          statistics: {
            total_capsules: statistics.totalCapsules,
            unlocked_capsules: statistics.unlockedCapsules,
            total_files: statistics.totalFiles,
          },
        });
      }

      // Refresh user context
      if (refreshUser) {
        await refreshUser();
      }

      setIsEditingName(false);
      toast.success('Display name updated successfully');
    } catch (err) {
      console.error('Error updating display name:', err);
      toast.error('Failed to update display name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset to original display name
    if (auth.currentUser?.displayName) {
      setDisplayName(auth.currentUser.displayName);
    }
    setDisplayNameError(undefined);
    setIsEditingName(false);
  };

  if (!user) {
    return null;
  }

  const accountCreationDate = new Date(user.created_at);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <User className="h-12 w-12 text-amber-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">Your Profile</h1>
          <p className="text-gray-600">Manage your account information and view your statistics</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* User Information Card */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-800">Account Information</CardTitle>
            <CardDescription>Your personal details and account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Display Name */}
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Display Name</p>
                {isEditingName ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex items-center space-x-2">
                      <Input
                        value={displayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value);
                          // Clear error when user starts typing
                          if (displayNameError) {
                            setDisplayNameError(undefined);
                          }
                        }}
                        placeholder="Enter your display name"
                        className={`flex-1 ${displayNameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        disabled={isSaving}
                      />
                      <Button
                        onClick={handleSaveDisplayName}
                        size="sm"
                        disabled={isSaving || !displayName.trim()}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {displayNameError && (
                      <p className="text-sm text-red-500">{displayNameError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-lg font-medium text-gray-800">
                      {displayName || 'Not set'}
                    </p>
                    <Button
                      onClick={() => setIsEditingName(true)}
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <Mail className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm text-gray-600">Email Address</p>
                <p className="text-lg font-medium text-gray-800">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm text-gray-600">Account Created</p>
                <p className="text-lg font-medium text-gray-800">
                  {format(accountCreationDate, 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Statistics Card */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-gray-800">Account Statistics</CardTitle>
            <CardDescription>Overview of your memory capsules and files</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                <span className="ml-3 text-gray-600">Loading statistics...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
                  <Package className="h-8 w-8 text-amber-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Capsules</p>
                    <p className="text-3xl font-bold text-gray-800">{statistics.totalCapsules}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <Unlock className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Unlocked Capsules</p>
                    <p className="text-3xl font-bold text-gray-800">{statistics.unlockedCapsules}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Files</p>
                    <p className="text-3xl font-bold text-gray-800">{statistics.totalFiles}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
