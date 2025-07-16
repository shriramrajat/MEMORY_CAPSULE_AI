
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Calendar as CalendarIcon, Upload, Heart, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CreateCapsuleProps {
  onBack: () => void;
}

export const CreateCapsule = ({ onBack }: CreateCapsuleProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [unlockDate, setUnlockDate] = useState<Date>();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content || !unlockDate) return;

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log("Creating capsule:", {
        title,
        content,
        unlockDate,
        files: selectedFiles.map(f => f.name)
      });
      setIsSubmitting(false);
      onBack(); // Return to dashboard
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-800">Create New Time Capsule</h1>
          <p className="text-gray-600">
            Write a message to your future self. Choose when you'd like to receive it.
          </p>
        </div>

        {/* Form */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-xl text-gray-800">
              <Heart className="h-6 w-6 mr-2 text-pink-500" />
              Your Message to the Future
            </CardTitle>
            <CardDescription>
              Be honest, be vulnerable, be yourself. Your future self will thank you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-700 font-medium">
                  Capsule Title
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Letter to 30-year-old me, Graduation memories..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-gray-200 focus:border-amber-400 focus:ring-amber-400"
                  required
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content" className="text-gray-700 font-medium">
                  Your Message
                </Label>
                <Textarea
                  id="content"
                  placeholder="Dear future me... What are you thinking about today? What dreams do you have? What advice would you give yourself?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[200px] border-gray-200 focus:border-amber-400 focus:ring-amber-400 resize-none"
                  required
                />
                <div className="flex items-center text-sm text-gray-500">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Write from the heart - your future self will appreciate the honesty
                </div>
              </div>

              {/* Unlock Date */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">
                  When should this unlock?
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-gray-200",
                        !unlockDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {unlockDate ? format(unlockDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={unlockDate}
                      onSelect={setUnlockDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-gray-500">
                  Choose a meaningful date - your birthday, graduation, new year, or just when you think you'll need this message.
                </p>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">
                  Add Photos or Files (Optional)
                </Label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700">
                      Click to upload files
                    </span>
                    <span className="text-gray-600"> or drag and drop</span>
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Images, videos, PDFs, or text files
                  </p>
                </div>

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Selected Files:</h4>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700 truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={!title || !content || !unlockDate || isSubmitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3"
                >
                  {isSubmitting ? "Creating Your Time Capsule..." : "Create Time Capsule"}
                </Button>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Your capsule will be safely stored and unlocked on {unlockDate ? format(unlockDate, "MMMM d, yyyy") : "your chosen date"}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
