
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Clock, Heart, Download, Share2, AlertCircle, Loader2, Edit, Save, X, Trash2, Upload, FileIcon, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { FileService } from "@/lib/file-service";
import { toast } from "sonner";

interface CapsuleDetailProps {
  capsuleId: string;
  onBack: () => void;
}

export const CapsuleDetail = ({ capsuleId, onBack }: CapsuleDetailProps) => {
  const [capsule, setCapsule] = useState<DecryptedCapsule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [filesToRemove, setFilesToRemove] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<number, number>>(new Map());
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareExpiration, setShareExpiration] = useState<Date | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { user, userKey } = useAuth();

  useEffect(() => {
    const fetchCapsule = async () => {
      if (!user || !userKey) {
        setError("Authentication required");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const fetchedCapsule = await SecureCapsuleDB.getCapsuleById(
          capsuleId,
          user.id,
          userKey
        );

        if (!fetchedCapsule) {
          setError("Capsule not found");
          toast.error("Capsule not found", {
            description: "The capsule you're looking for doesn't exist or you don't have access to it.",
          });
        } else {
          setCapsule(fetchedCapsule);
        }
      } catch (err) {
        console.error("Error fetching capsule:", err);
        setError("Failed to load capsule");
        toast.error("Error loading capsule", {
          description: "There was a problem loading your capsule. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCapsule();
  }, [capsuleId, user, userKey]);

  const handleDownloadFile = async (
    fileId: string,
    fileName: string,
    filePath: string,
    fileIv: string,
    fileType: string
  ) => {
    if (!userKey) {
      toast.error("Download failed", {
        description: "User encryption key not available. Please try logging in again.",
      });
      return;
    }

    try {
      setDownloadingFiles(prev => new Set(prev).add(fileId));
      
      await FileService.downloadFile(
        fileId,
        fileName,
        filePath,
        fileIv,
        userKey,
        fileType
      );

      toast.success("Download successful", {
        description: `${fileName} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : "Failed to download file. Please try again.",
      });
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const handleEditClick = () => {
    if (!capsule) return;

    if (!capsule.isUnlocked) {
      toast.error("Cannot edit locked capsule", {
        description: "This capsule is locked until its unlock date. You can only edit unlocked capsules.",
      });
      return;
    }

    setEditedTitle(capsule.title);
    // Extract only the main content, not the audio transcription
    const mainContent = capsule.content.split('--- Audio Transcription ---')[0]?.trim() || capsule.content;
    setEditedContent(mainContent);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedTitle("");
    setEditedContent("");
    setNewFiles([]);
    setFilesToRemove(new Set());
    setUploadProgress(new Map());
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate each file
    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      const validation = FileService.validateFile(file);
      if (!validation.isValid) {
        toast.error("Invalid file", {
          description: validation.error,
        });
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setNewFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkFileForRemoval = (fileId: string) => {
    setFilesToRemove(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleSaveEdit = async () => {
    if (!user || !userKey || !capsule) return;

    // Validate inputs
    if (!editedTitle.trim()) {
      toast.error("Validation error", {
        description: "Title cannot be empty",
      });
      return;
    }

    if (!editedContent.trim()) {
      toast.error("Validation error", {
        description: "Content cannot be empty",
      });
      return;
    }

    try {
      setIsSaving(true);

      // Preserve audio transcription if it exists
      let finalContent = editedContent;
      if (capsule.content.includes('--- Audio Transcription ---')) {
        const transcription = capsule.content.split('--- Audio Transcription ---')[1];
        finalContent = `${editedContent}\n\n--- Audio Transcription ---\n${transcription}`;
      }

      // Update capsule content
      await SecureCapsuleDB.updateCapsule(
        capsuleId,
        user.id,
        userKey,
        {
          title: editedTitle,
          content: finalContent,
        }
      );

      // Delete files marked for removal
      if (filesToRemove.size > 0) {
        const filesToDelete = capsule.files?.filter(f => filesToRemove.has(f.id)) || [];
        for (const file of filesToDelete) {
          try {
            await FileService.deleteFile(file.id, file.filePath);
          } catch (err) {
            console.error(`Failed to delete file ${file.id}:`, err);
            // Continue with other deletions
          }
        }
      }

      // Upload new files
      if (newFiles.length > 0) {
        await FileService.uploadFiles(
          capsuleId,
          newFiles,
          userKey,
          user.id,
          (fileIndex, progress) => {
            setUploadProgress(prev => new Map(prev).set(fileIndex, progress));
          }
        );
      }

      // Fetch updated capsule with new files
      const updatedCapsule = await SecureCapsuleDB.getCapsuleById(
        capsuleId,
        user.id,
        userKey
      );

      if (updatedCapsule) {
        setCapsule(updatedCapsule);
      }

      setIsEditMode(false);
      setNewFiles([]);
      setFilesToRemove(new Set());
      setUploadProgress(new Map());
      
      toast.success("Capsule updated", {
        description: "Your changes have been saved successfully.",
      });
    } catch (err) {
      console.error("Error updating capsule:", err);
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : "Failed to update capsule. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCapsule = async () => {
    if (!user) return;

    try {
      setIsDeleting(true);

      await SecureCapsuleDB.deleteCapsule(capsuleId, user.id);

      toast.success("Capsule deleted", {
        description: "Your capsule and all associated files have been permanently deleted.",
      });

      // Navigate back to dashboard after successful deletion
      onBack();
    } catch (err) {
      console.error("Error deleting capsule:", err);
      toast.error("Deletion failed", {
        description: err instanceof Error ? err.message : "Failed to delete capsule. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCapsule = async (format: 'json' | 'text' = 'json') => {
    if (!user || !userKey) {
      toast.error("Export failed", {
        description: "User authentication required. Please try logging in again.",
      });
      return;
    }

    try {
      setIsExporting(true);

      const blob = await SecureCapsuleDB.exportCapsule(
        capsuleId,
        user.id,
        userKey,
        format
      );

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'json' ? 'json' : 'txt';
      const fileName = `capsule-${capsule?.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.${extension}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Export successful", {
        description: `Your capsule has been exported as ${fileName}`,
      });
    } catch (err) {
      console.error("Error exporting capsule:", err);
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Failed to export capsule. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!user) {
      toast.error("Share failed", {
        description: "User authentication required. Please try logging in again.",
      });
      return;
    }

    try {
      setIsGeneratingShareLink(true);

      const { token, expiresAt } = await SecureCapsuleDB.generateShareLink(
        capsuleId,
        user.id,
        7 // 7 days expiration
      );

      // Generate full share URL
      const baseUrl = window.location.origin;
      const fullShareLink = `${baseUrl}/share/${token}`;

      setShareLink(fullShareLink);
      setShareExpiration(expiresAt);
      setIsShareDialogOpen(true);

      toast.success("Share link generated", {
        description: "Your share link has been created and will expire in 7 days.",
      });
    } catch (err) {
      console.error("Error generating share link:", err);
      toast.error("Share failed", {
        description: err instanceof Error ? err.message : "Failed to generate share link. Please try again.",
      });
    } finally {
      setIsGeneratingShareLink(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      
      toast.success("Link copied", {
        description: "Share link has been copied to your clipboard.",
      });

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Error copying to clipboard:", err);
      toast.error("Copy failed", {
        description: "Failed to copy link to clipboard. Please try again.",
      });
    }
  };

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

  if (error || !capsule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-800 font-semibold text-lg mb-2">
            {error || "Capsule not found"}
          </p>
          <p className="text-gray-600 mb-4">
            {error === "Authentication required" 
              ? "Please sign in to view your capsules."
              : "The capsule you're looking for doesn't exist or you don't have access to it."}
          </p>
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
            {!isEditMode && capsule.isUnlocked && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleEditClick}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportCapsule('json')}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleGenerateShareLink}
                  disabled={isGeneratingShareLink}
                >
                  {isGeneratingShareLink ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share Capsule</DialogTitle>
                  <DialogDescription>
                    Anyone with this link can view your capsule. The link will expire on{' '}
                    {shareExpiration && format(shareExpiration, 'MMMM d, yyyy')}.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor="share-link" className="sr-only">
                      Share link
                    </Label>
                    <Input
                      id="share-link"
                      value={shareLink || ''}
                      readOnly
                      className="h-9"
                    />
                  </div>
                  <Button 
                    type="button" 
                    size="sm" 
                    className="px-3"
                    onClick={handleCopyShareLink}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-sm text-gray-500">
                  <p>⚠️ This link will allow anyone to view your capsule content without authentication.</p>
                  <p className="mt-1">The link will automatically expire in 7 days.</p>
                </div>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your capsule
                    "{capsule.title}" and all associated files from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteCapsule}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete Capsule
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Capsule Content */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                {isEditMode ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit-title" className="text-sm font-medium text-gray-700">
                        Title
                      </Label>
                      <Input
                        id="edit-title"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="mt-1"
                        placeholder="Enter capsule title"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              
              {!isEditMode && (
                <div className="flex space-x-2">
                  <Badge className={getSentimentColor(capsule.sentiment)}>
                    {capsule.sentiment || 'neutral'}
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Unlocked
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* AI Summary */}
            {capsule.summary && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <Heart className="h-5 w-5 mr-2 text-purple-500" />
                  AI Summary
                </h3>
                <p className="text-gray-700 leading-relaxed italic">
                  {capsule.summary}
                </p>
                
                {/* AI Themes */}
                {capsule.themes && capsule.themes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Themes:</h4>
                    <div className="flex flex-wrap gap-2">
                      {capsule.themes.map((theme, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="bg-white/50 text-purple-700 border-purple-200"
                        >
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message Content */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <Heart className="h-5 w-5 mr-2 text-pink-500" />
                Your Message
              </h3>
              {isEditMode ? (
                <div>
                  <Label htmlFor="edit-content" className="text-sm font-medium text-gray-700">
                    Content
                  </Label>
                  <Textarea
                    id="edit-content"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="mt-2 min-h-[200px]"
                    placeholder="Enter your message"
                  />
                </div>
              ) : (
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {capsule.content.split('--- Audio Transcription ---')[0]?.trim() || capsule.content}
                  </p>
                </div>
              )}
            </div>

            {/* Audio Transcription Section */}
            {capsule.content.includes('--- Audio Transcription ---') && (
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Heart className="h-5 w-5 mr-2 text-blue-500" />
                  Audio Transcription
                </h3>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line italic">
                    {capsule.content.split('--- Audio Transcription ---')[1]?.trim() || ''}
                  </p>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  This text was automatically transcribed from your audio recording.
                </p>
              </div>
            )}

            {/* File Management in Edit Mode */}
            {isEditMode && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Upload className="h-5 w-5 mr-2 text-blue-500" />
                  Manage Files
                </h3>

                {/* Existing Files */}
                {capsule.files && capsule.files.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Existing Files</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {capsule.files.map((file) => {
                        const isMarkedForRemoval = filesToRemove.has(file.id);
                        return (
                          <div
                            key={file.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              isMarkedForRemoval ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <FileIcon className="h-5 w-5 text-gray-600" />
                              <div>
                                <p className={`text-sm font-medium ${isMarkedForRemoval ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">{file.type}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={isMarkedForRemoval ? "outline" : "destructive"}
                              onClick={() => handleMarkFileForRemoval(file.id)}
                            >
                              {isMarkedForRemoval ? (
                                <>
                                  <X className="h-4 w-4 mr-1" />
                                  Undo
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* New Files */}
                {newFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">New Files to Upload</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {newFiles.map((file, index) => {
                        const progress = uploadProgress.get(index) || 0;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <FileIcon className="h-5 w-5 text-green-600" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                                <p className="text-xs text-gray-500">{file.type}</p>
                                {progress > 0 && progress < 100 && (
                                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-green-600 h-1.5 rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveNewFile(index)}
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* File Upload Button */}
                <div>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="h-5 w-5 mr-2 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Add Files</span>
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported: Images, Videos, Documents, Audio files
                  </p>
                </div>
              </div>
            )}

            {/* Attached Files (View Mode) */}
            {!isEditMode && capsule.files && capsule.files.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Download className="h-5 w-5 mr-2 text-blue-500" />
                  Attached Memories
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {capsule.files.map((file) => {
                    const isImage = file.type.startsWith('image/');
                    const isVideo = file.type.startsWith('video/');
                    const isAudio = file.type.startsWith('audio/');
                    const isDownloading = downloadingFiles.has(file.id);
                    
                    return (
                      <Card key={file.id} className="border border-gray-200">
                        <CardContent className="p-4">
                          {isImage && (
                            <div className="space-y-3">
                              <img 
                                src={file.url} 
                                alt={file.name}
                                className="w-full h-48 object-cover rounded-lg"
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">{file.name}</p>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleDownloadFile(
                                    file.id,
                                    file.name,
                                    file.filePath,
                                    file.fileIv,
                                    file.type
                                  )}
                                  disabled={isDownloading}
                                >
                                  {isDownloading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Downloading...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {isVideo && (
                            <div className="space-y-3">
                              <video 
                                src={file.url}
                                controls
                                className="w-full h-48 rounded-lg"
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">{file.name}</p>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleDownloadFile(
                                    file.id,
                                    file.name,
                                    file.filePath,
                                    file.fileIv,
                                    file.type
                                  )}
                                  disabled={isDownloading}
                                >
                                  {isDownloading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Downloading...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {isAudio && (
                            <div className="space-y-3">
                              <audio 
                                src={file.url}
                                controls
                                className="w-full"
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">{file.name}</p>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleDownloadFile(
                                    file.id,
                                    file.name,
                                    file.filePath,
                                    file.fileIv,
                                    file.type
                                  )}
                                  disabled={isDownloading}
                                >
                                  {isDownloading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Downloading...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {!isImage && !isVideo && !isAudio && (
                            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Download className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-800">{file.name}</p>
                                <p className="text-sm text-gray-600">{file.type}</p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDownloadFile(
                                  file.id,
                                  file.name,
                                  file.filePath,
                                  file.fileIv,
                                  file.type
                                )}
                                disabled={isDownloading}
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
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
