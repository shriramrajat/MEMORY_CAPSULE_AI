import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, Calendar, Tag, Download } from "lucide-react";
import { SecureCapsuleDB, type DecryptedCapsule } from "@/lib/database";
import ErrorBoundary from "@/components/ErrorBoundary";

const SharedCapsuleContent = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [capsule, setCapsule] = useState<DecryptedCapsule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const fetchSharedCapsule = async () => {
      if (!token) {
        setError("Invalid share link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await SecureCapsuleDB.getSharedCapsule(token);
        
        if (!result) {
          setError("This share link is invalid or has been removed");
          setLoading(false);
          return;
        }

        if (result.isExpired) {
          setIsExpired(true);
          setError("This share link has expired");
          setLoading(false);
          return;
        }

        setCapsule(result.capsule);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch shared capsule:", err);
        setError("Failed to load shared capsule. Please try again later.");
        setLoading(false);
      }
    };

    fetchSharedCapsule();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading shared capsule...</p>
        </div>
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isExpired ? <Lock className="h-5 w-5" /> : null}
              {isExpired ? "Link Expired" : "Access Denied"}
            </CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                {isExpired 
                  ? "This share link has expired and is no longer accessible. Please contact the capsule owner for a new link."
                  : "The capsule you're trying to access is not available. It may have been removed or the link is invalid."}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate("/")} 
              className="w-full mt-4"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription>
              This is a shared memory capsule. You're viewing it without authentication.
            </AlertDescription>
          </Alert>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{capsule.title}</CardTitle>
            <CardDescription className="flex flex-wrap gap-4 mt-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created: {capsule.createdAt.toLocaleDateString()}
              </span>
              {capsule.sentiment && (
                <span className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Sentiment: {capsule.sentiment}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {capsule.summary && (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="font-semibold text-amber-900 mb-2">AI Summary</h3>
                <p className="text-amber-800">{capsule.summary}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Content</h3>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap">{capsule.content}</p>
              </div>
            </div>

            {capsule.themes && capsule.themes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Themes</h3>
                <div className="flex flex-wrap gap-2">
                  {capsule.themes.map((theme, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {capsule.files && capsule.files.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Attached Files ({capsule.files.length})</h3>
                <div className="space-y-2">
                  {capsule.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-gray-500">({file.type})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button 
                onClick={() => navigate("/")} 
                variant="outline"
                className="w-full"
              >
                Create Your Own Memory Capsule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SharedCapsule = () => {
  return (
    <ErrorBoundary>
      <SharedCapsuleContent />
    </ErrorBoundary>
  );
};

export default SharedCapsule;
