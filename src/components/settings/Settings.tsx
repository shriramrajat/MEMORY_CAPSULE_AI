import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Monitor, Bell, Mail, Download, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import { toast } from "sonner";
import { NotificationService } from "@/lib/notification-service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsProps {
  onBack: () => void;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications_enabled: boolean;
  email_notifications: boolean;
  notification_fallback?: boolean;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'auto',
    notifications_enabled: false,
    email_notifications: false,
    notification_fallback: false,
  });

  useEffect(() => {
    const fetchUserPreferences = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch user document from Firestore
        const userDocRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.preferences) {
            setPreferences({
              theme: userData.preferences.theme || 'auto',
              notifications_enabled: userData.preferences.notifications_enabled || false,
              email_notifications: userData.preferences.email_notifications || false,
              notification_fallback: userData.preferences.notification_fallback || false,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching user preferences:', err);
        setError('Failed to load your settings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserPreferences();
  }, [user]);

  const savePreferences = async (updatedPreferences: UserPreferences) => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);

      // Update user document in Firestore
      const userDocRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        // Update existing document
        await setDoc(userDocRef, {
          preferences: updatedPreferences,
        }, { merge: true });
      } else {
        // Create new document with preferences
        await setDoc(userDocRef, {
          user_id: user.id,
          email: user.email,
          display_name: '',
          created_at: new Date(user.created_at),
          last_login: new Date(),
          preferences: updatedPreferences,
          statistics: {
            total_capsules: 0,
            unlocked_capsules: 0,
            total_files: 0,
          },
        });
      }

      setPreferences(updatedPreferences);
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Failed to save settings. Please try again.');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    // Update theme immediately in ThemeContext
    setTheme(newTheme);
    
    // Save to Firestore
    const updatedPreferences = { ...preferences, theme: newTheme };
    await savePreferences(updatedPreferences);
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      // Request browser notification permissions
      const permissionGranted = await NotificationService.requestPermissions();
      
      if (!permissionGranted) {
        // Check if permission was denied
        const isDenied = NotificationService.isPermissionDenied();
        
        if (isDenied) {
          // Store fallback preference
          if (user) {
            await NotificationService.storeFallbackPreference(user.id, true);
          }
          
          // Update local state to reflect fallback mode
          const updatedPreferences = { 
            ...preferences, 
            notifications_enabled: true, // Still enable notifications
            notification_fallback: true  // But use in-app only
          };
          await savePreferences(updatedPreferences);
          
          toast.info('Browser notifications are not available. You will receive in-app notifications only.');
        } else {
          toast.error('Notification permission denied. Please enable notifications in your browser settings.');
        }
        return;
      }
      
      // Permission granted - clear fallback mode
      if (user) {
        await NotificationService.storeFallbackPreference(user.id, false);
      }
      
      toast.success('Browser notifications enabled');
    }
    
    const updatedPreferences = { 
      ...preferences, 
      notifications_enabled: enabled,
      notification_fallback: enabled ? preferences.notification_fallback : false
    };
    await savePreferences(updatedPreferences);
  };

  const handleEmailNotificationsToggle = async (enabled: boolean) => {
    const updatedPreferences = { ...preferences, email_notifications: enabled };
    await savePreferences(updatedPreferences);
  };

  const handleDataExport = () => {
    // Placeholder for data export functionality
    toast.info('Data export feature coming soon!');
  };

  if (!user) {
    return null;
  }

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
            <SettingsIcon className="h-12 w-12 text-amber-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">Settings</h1>
          <p className="text-gray-600">Manage your preferences and customize your experience</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            <span className="ml-3 text-gray-600">Loading settings...</span>
          </div>
        ) : (
          <>
            {/* Theme Preferences Card */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-800 flex items-center">
                  <Monitor className="h-6 w-6 mr-2 text-amber-600" />
                  Appearance
                </CardTitle>
                <CardDescription>Customize how Memory Capsule looks on your device</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme-select" className="text-base font-medium text-gray-700">
                    Theme Preference
                  </Label>
                  <Select
                    value={theme}
                    onValueChange={(value) => handleThemeChange(value as 'light' | 'dark' | 'auto')}
                    disabled={saving}
                  >
                    <SelectTrigger id="theme-select" className="w-full">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center">
                          <Sun className="h-4 w-4 mr-2" />
                          Light
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center">
                          <Moon className="h-4 w-4 mr-2" />
                          Dark
                        </div>
                      </SelectItem>
                      <SelectItem value="auto">
                        <div className="flex items-center">
                          <Monitor className="h-4 w-4 mr-2" />
                          Auto (System)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Choose your preferred color scheme or let it match your system settings
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings Card */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-800 flex items-center">
                  <Bell className="h-6 w-6 mr-2 text-amber-600" />
                  Notifications
                </CardTitle>
                <CardDescription>Control how you receive updates about your capsules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Browser Notifications */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="notifications-toggle" className="text-base font-medium text-gray-700 cursor-pointer">
                      Browser Notifications
                    </Label>
                    <p className="text-sm text-gray-500">
                      Get notified when your capsules unlock
                    </p>
                    {preferences.notification_fallback && preferences.notifications_enabled && (
                      <Alert className="mt-2 bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-800">
                          Browser notifications are not available. You will receive in-app notifications only.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <Switch
                    id="notifications-toggle"
                    checked={preferences.notifications_enabled}
                    onCheckedChange={handleNotificationsToggle}
                    disabled={saving}
                  />
                </div>

                {/* Email Notifications */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="email-notifications-toggle" className="text-base font-medium text-gray-700 cursor-pointer">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-amber-600" />
                        Email Notifications
                      </div>
                    </Label>
                    <p className="text-sm text-gray-500">
                      Receive email reminders for unlocked capsules
                    </p>
                  </div>
                  <Switch
                    id="email-notifications-toggle"
                    checked={preferences.email_notifications}
                    onCheckedChange={handleEmailNotificationsToggle}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Data Management Card */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-800 flex items-center">
                  <Download className="h-6 w-6 mr-2 text-amber-600" />
                  Data Management
                </CardTitle>
                <CardDescription>Export and manage your personal data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <h3 className="font-medium text-gray-700">Export Your Data</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Download all your capsules and associated files in a portable format
                    </p>
                  </div>
                  <Button
                    onClick={handleDataExport}
                    variant="outline"
                    className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
