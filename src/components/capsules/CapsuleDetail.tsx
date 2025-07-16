
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, Heart, Download, Share2 } from "lucide-react";
import { format } from "date-fns";

interface CapsuleDetailProps {
  capsuleId: string;
  onBack: () => void;
}

interface Capsule {
  id: string;
  title: string;
  content: string;
  unlockDate: Date;
  createdAt: Date;
  isUnlocked: boolean;
  type: 'text' | 'image' | 'mixed';
  sentiment?: 'positive' | 'neutral' | 'negative';
  files?: Array<{
    name: string;
    type: 'image' | 'video' | 'document';
    url: string;
  }>;
}

export const CapsuleDetail = ({ capsuleId, onBack }: CapsuleDetailProps) => {
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock API call - replace with actual data fetching
    setTimeout(() => {
      const mockCapsule: Capsule = {
        id: capsuleId,
        title: "College Graduation Memories",
        content: `Dear future me,

Today I graduated from college! I can't believe four years have gone by so quickly. As I'm writing this, I'm sitting in my dorm room one last time, surrounded by boxes and memories.

I'm scared but excited about what's next. I got the job offer from TechCorp, and even though it's not exactly what I dreamed of, it feels like a good start. I hope by the time you're reading this, you remember how brave you felt taking that first step into the unknown.

Right now I'm worried about:
- Making new friends in a new city
- Being good enough at my job
- Whether I chose the right path

But I'm also hopeful about:
- Learning new things every day
- Building a life that feels authentically mine
- All the adventures ahead

I hope you're proud of how far we've come. Remember to be kind to yourself - you're doing better than you think.

Love,
Past You

P.S. I hope you still remember how much you loved those late-night conversations with Emma about changing the world. Don't let that spark die.`,
        unlockDate: new Date("2024-06-15"),
        createdAt: new Date("2023-06-15"),
        isUnlocked: true,
        type: 'mixed',
        sentiment: 'positive',
        files: [
          {
            name: "graduation-photo.jpg",
            type: 'image',
            url: "/api/placeholder/400/300"
          },
          {
            name: "diploma.pdf", 
            type: 'document',
            url: "/api/files/diploma.pdf"
          }
        ]
      };
      
      setCapsule(mockCapsule);
      setIsLoading(false);
    }, 1000);
  }, [capsuleId]);

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Opening your time capsule...</p>
        </div>
      </div>
    );
  }

  if (!capsule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Capsule not found</p>
          <Button onClick={onBack} className="mt-4">
            Back to Dashboard
          </Button>
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
          
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Capsule Content */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl text-gray-800 flex items-center">
                  <Heart className="h-6 w-6 mr-3 text-pink-500" />
                  {capsule.title}
                </CardTitle>
                <CardDescription className="flex items-center space-x-4 text-gray-600">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Created {format(capsule.createdAt, 'MMMM d, yyyy')}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Unlocked {format(capsule.unlockDate, 'MMMM d, yyyy')}
                  </span>
                </CardDescription>
              </div>
              
              <div className="flex space-x-2">
                <Badge className={getSentimentColor(capsule.sentiment)}>
                  {capsule.sentiment || 'neutral'}
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Unlocked
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Message Content */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Heart className="h-5 w-5 mr-2 text-pink-500" />
                Your Message
              </h3>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {capsule.content}
                </p>
              </div>
            </div>

            {/* Attached Files */}
            {capsule.files && capsule.files.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Download className="h-5 w-5 mr-2 text-blue-500" />
                  Attached Memories
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {capsule.files.map((file, index) => (
                    <Card key={index} className="border border-gray-200">
                      <CardContent className="p-4">
                        {file.type === 'image' && (
                          <div className="space-y-3">
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <p className="text-sm text-gray-600">{file.name}</p>
                          </div>
                        )}
                        
                        {file.type === 'document' && (
                          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Download className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{file.name}</p>
                              <p className="text-sm text-gray-600">Document</p>
                            </div>
                            <Button size="sm" variant="outline">
                              Download
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Reflection Prompt */}
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Reflection Time
              </h3>
              <p className="text-gray-700 mb-4">
                Now that you've read this message from your past self, take a moment to reflect:
              </p>
              <ul className="space-y-2 text-gray-700">
                <li>• What has changed since you wrote this?</li>
                <li>• What advice would you give to your past self?</li>
                <li>• What dreams are you still working toward?</li>
              </ul>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                Write a Response
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
