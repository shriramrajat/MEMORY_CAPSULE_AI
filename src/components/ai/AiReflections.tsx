
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, TrendingUp, Heart, Brain, Calendar } from "lucide-react";
import { format, subMonths } from "date-fns";

interface AiReflection {
  id: string;
  content: string;
  type: 'periodic' | 'milestone' | 'trend';
  createdAt: Date;
  analyzedPeriod: {
    start: Date;
    end: Date;
  };
  sentimentTrend: 'improving' | 'stable' | 'declining';
  keyThemes: string[];
}

interface AiReflectionsProps {
  onBack: () => void;
}

export const AiReflections = ({ onBack }: AiReflectionsProps) => {
  const [reflections, setReflections] = useState<AiReflection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock data - replace with actual API calls
    setTimeout(() => {
      const mockReflections: AiReflection[] = [
        {
          id: "1",
          content: `Looking at your entries from the past three months, I notice a beautiful pattern of growth and self-compassion. 

Your writing has evolved from uncertainty about your career path to a more confident voice discussing your achievements and goals. The themes of "learning" and "growth" appear 12 times across your capsules, suggesting a deep commitment to personal development.

There's a notable shift in how you talk about challenges - earlier entries focused on fears and doubts, while recent ones frame obstacles as opportunities. This suggests you're developing stronger resilience and a more positive mindset.

Your relationships seem to be a consistent source of joy, with Emma and your family mentioned frequently in contexts of gratitude and love. The care you show for others reflects the kindness you're learning to show yourself.

Keep nurturing this gentle confidence you're building. Your past self would be proud of how far you've come.`,
          type: 'periodic',
          createdAt: new Date(),
          analyzedPeriod: {
            start: subMonths(new Date(), 3),
            end: new Date()
          },
          sentimentTrend: 'improving',
          keyThemes: ['growth', 'relationships', 'confidence', 'gratitude', 'learning']
        },
        {
          id: "2", 
          content: `Your recent graduation capsule reveals so much about your character - the vulnerability you showed in expressing both fear and excitement demonstrates emotional maturity.

The way you acknowledged your worries while still choosing hope shows remarkable self-awareness. Your concern for "making new friends" and "being good enough" are deeply human and relatable fears that many share during major life transitions.

What stands out is your commitment to authenticity - "building a life that feels authentically mine" appears to be a core value driving your decisions. This self-knowledge will serve you well.

The love and encouragement you showed your future self in that letter reflects the same kindness you deserve to show yourself today.`,
          type: 'milestone',
          createdAt: subMonths(new Date(), 1),
          analyzedPeriod: {
            start: new Date("2023-06-15"),
            end: new Date("2023-06-15")
          },
          sentimentTrend: 'stable',
          keyThemes: ['transition', 'authenticity', 'vulnerability', 'hope', 'self-compassion']
        }
      ];
      
      setReflections(mockReflections);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleGenerateReflection = async () => {
    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      console.log("Generating new AI reflection based on recent capsules...");
      setIsGenerating(false);
      // Would refresh reflections here
    }, 3000);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'periodic': return 'bg-blue-100 text-blue-800';
      case 'milestone': return 'bg-purple-100 text-purple-800';
      case 'trend': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="h-8 w-8 animate-pulse text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your AI reflections...</p>
        </div>
      </div>
    );
  }

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
            disabled={isGenerating}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
          >
            <Brain className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate New Reflection"}
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

        {/* Reflections */}
        <div className="space-y-6">
          {reflections.map((reflection) => (
            <Card key={reflection.id} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <CardTitle className="text-xl text-gray-800 flex items-center">
                        <Brain className="h-6 w-6 mr-2 text-blue-500" />
                        AI Reflection
                      </CardTitle>
                      <Badge className={getTypeColor(reflection.type)}>
                        {reflection.type}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center space-x-4 text-gray-600">
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(reflection.createdAt, 'MMMM d, yyyy')}
                      </span>
                      <span className="flex items-center">
                        Analyzing {format(reflection.analyzedPeriod.start, 'MMM d')} - {format(reflection.analyzedPeriod.end, 'MMM d, yyyy')}
                      </span>
                    </CardDescription>
                  </div>
                  
                  <div className={`flex items-center space-x-1 ${getTrendColor(reflection.sentimentTrend)}`}>
                    {getTrendIcon(reflection.sentimentTrend)}
                    <span className="text-sm font-medium capitalize">
                      {reflection.sentimentTrend}
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Reflection Content */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {reflection.content}
                    </p>
                  </div>
                </div>

                {/* Key Themes */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <Heart className="h-4 w-4 mr-2 text-pink-500" />
                    Key Themes Discovered
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {reflection.keyThemes.map((theme, index) => (
                      <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-4 border-t border-gray-100">
                  <Button variant="outline" size="sm">
                    Share Insight
                  </Button>
                  <Button variant="outline" size="sm">
                    Save to Favorites
                  </Button>
                  <Button variant="outline" size="sm">
                    Export as PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {reflections.length === 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No reflections yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create more time capsules to help your AI Memory Agent generate meaningful insights about your journey.
              </p>
              <Button
                onClick={handleGenerateReflection}
                disabled={isGenerating}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              >
                <Brain className="h-4 w-4 mr-2" />
                {isGenerating ? "Analyzing..." : "Generate First Reflection"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
