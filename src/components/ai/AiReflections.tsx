
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Sparkles, TrendingUp, Heart, Brain, Calendar, Loader2, AlertCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { aiService, AIReflection } from "@/lib/ai-service";

interface AiReflectionsProps {
  onBack: () => void;
}

export const AiReflections = ({ onBack }: AiReflectionsProps) => {
  const [reflection, setReflection] = useState<AIReflection | null>(null);
  const [capsules, setCapsules] = useState<DecryptedCapsule[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, userKey } = useAuth();

  useEffect(() => {
    const loadCapsulesAndReflection = async () => {
      if (!user || !userKey) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch capsules from Firebase
        const fetchedCapsules = await SecureCapsuleDB.getUserCapsules(user.id, userKey);
        setCapsules(fetchedCapsules);

        // Generate initial reflection if we have capsules
        if (fetchedCapsules.length > 0) {
          const aiReflection = await aiService.generateReflection(fetchedCapsules);
          setReflection(aiReflection);
        }
      } catch (err) {
        console.error('Error loading capsules or generating reflection:', err);
        setError('Failed to load your reflections. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadCapsulesAndReflection();
  }, [user, userKey]);

  const handleGenerateReflection = async () => {
    if (capsules.length === 0) {
      setError('You need to create some capsules before generating reflections.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const aiReflection = await aiService.generateReflection(capsules);
      setReflection(aiReflection);
    } catch (err) {
      console.error('Error generating reflection:', err);
      setError('Failed to generate reflection. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Determine sentiment trend based on capsule sentiments
  const getSentimentTrend = (): 'improving' | 'stable' | 'declining' => {
    if (capsules.length < 2) return 'stable';
    
    const recentCapsules = capsules.slice(0, Math.min(5, capsules.length));
    const positiveCount = recentCapsules.filter(c => c.sentiment === 'positive').length;
    const negativeCount = recentCapsules.filter(c => c.sentiment === 'negative').length;
    
    if (positiveCount > negativeCount * 1.5) return 'improving';
    if (negativeCount > positiveCount * 1.5) return 'declining';
    return 'stable';
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4" />;
      case 'declining': return <TrendingUp className="h-4 w-4 rotate-180" />;
      default: return <TrendingUp className="h-4 w-4 rotate-90" />;
    }
  };

  // Extract key themes from capsules
  const getKeyThemes = (): string[] => {
    const allThemes = capsules.flatMap(c => c.themes || []);
    const themeCounts = allThemes.reduce((acc, theme) => {
      acc[theme] = (acc[theme] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(themeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([theme]) => theme);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading your AI reflections...</p>
        </div>
      </div>
    );
  }

  const sentimentTrend = getSentimentTrend();
  const keyThemes = getKeyThemes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
          
          <Button
            onClick={handleGenerateReflection}
            disabled={isGenerating || capsules.length === 0}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Regenerate Reflection
              </>
            )}
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center">
            <Sparkles className="h-8 w-8 mr-3 text-blue-500" />
            AI Memory Reflections
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Your AI Memory Agent analyzes patterns in your time capsules and offers gentle insights 
            into your growth, emotions, and journey through time.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* AI Service Unavailable Warning */}
        {!aiService.isAvailable() && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>AI Service Unavailable</AlertTitle>
            <AlertDescription>
              AI features require a Gemini API key to be configured. Reflections will use basic analysis.
            </AlertDescription>
          </Alert>
        )}

        {/* Reflection Display */}
        {reflection && capsules.length > 0 && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-xl text-gray-800 flex items-center">
                      <Brain className="h-6 w-6 mr-2 text-blue-500" />
                      AI Reflection
                    </CardTitle>
                    <Badge className="bg-blue-100 text-blue-800">
                      Analyzing {capsules.length} capsule{capsules.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center space-x-4 text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Generated {format(new Date(), 'MMMM d, yyyy')}
                    </span>
                  </CardDescription>
                </div>
                
                <div className={`flex items-center space-x-1 ${getTrendColor(sentimentTrend)}`}>
                  {getTrendIcon(sentimentTrend)}
                  <span className="text-sm font-medium capitalize">
                    {sentimentTrend}
                  </span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Overall Sentiment */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                  Overall Sentiment
                </h4>
                <p className="text-gray-700 leading-relaxed">
                  {reflection.overallSentiment}
                </p>
              </div>

              {/* Patterns */}
              {reflection.patterns.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Brain className="h-4 w-4 mr-2 text-purple-500" />
                    Recurring Patterns
                  </h4>
                  <ul className="space-y-2">
                    {reflection.patterns.map((pattern, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-purple-500 mr-2">•</span>
                        <span className="text-gray-700">{pattern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insights */}
              {reflection.insights.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                    Key Insights
                  </h4>
                  <ul className="space-y-2">
                    {reflection.insights.map((insight, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span className="text-gray-700">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {reflection.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Heart className="h-4 w-4 mr-2 text-pink-500" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {reflection.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-pink-500 mr-2">•</span>
                        <span className="text-gray-700">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Themes */}
              {keyThemes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Heart className="h-4 w-4 mr-2 text-pink-500" />
                    Key Themes Discovered
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {keyThemes.map((theme, index) => (
                      <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {capsules.length === 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No capsules yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create some time capsules to help your AI Memory Agent generate meaningful insights about your journey.
              </p>
              <Button
                onClick={onBack}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Capsule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
