import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB } from "@/lib/database";
import { toast } from "sonner";

interface CreateCapsuleProps {
  onBack: () => void;
}

export const CreateCapsule = ({ onBack }: CreateCapsuleProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !title.trim() || !content.trim() || !unlockDate) {
      toast.error('Please fill in all fields');
      return;
    }

    const selectedDate = new Date(unlockDate);
    if (selectedDate <= new Date()) {
      toast.error('Unlock date must be in the future');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await SecureCapsuleDB.createCapsule(user.uid, {
        title: title.trim(),
        content: content.trim(),
        unlockDate: selectedDate
      });
      
      toast.success('Memory capsule created successfully!');
      onBack();
    } catch (error) {
      console.error('Error creating capsule:', error);
      toast.error('Failed to create capsule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Create Memory Capsule</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Memory Capsule</CardTitle>
          <CardDescription>
            Create a time-locked memory that will unlock on a future date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your memory a title..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your memory here..."
                rows={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unlockDate">Unlock Date</Label>
              <Input
                id="unlockDate"
                type="datetime-local"
                value={unlockDate}
                onChange={(e) => setUnlockDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                required
              />
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Capsule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};