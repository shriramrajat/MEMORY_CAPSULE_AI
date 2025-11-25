
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar as CalendarIcon, Upload, Heart, MessageSquare, X, CheckCircle, AlertCircle, Mic, Square, Play, Pause } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB } from "@/lib/database";
import { FileService } from "@/lib/file-service";
import { AudioService } from "@/lib/audio-service";
import { aiService } from "@/lib/ai-service";
import { toast } from "sonner";

interface CreateCapsuleProps {
  onBack: () => void;
}

interface FileUploadStatus {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const CreateCapsule = ({ onBack }: CreateCapsuleProps) => {
  const { user, userKey } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [unlockDate, setUnlockDate] = useState<Date>();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileUploadStatuses, setFileUploadStatuses] = useState<FileUploadStatus[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const uploadCancelledRef = useRef(false);
  const [errors, setErrors] = useState<{
    title?: string;
    content?: string;
    unlockDate?: string;
    files?: string;
  }>({});

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioServiceRef = useRef<AudioService>(new AudioService());
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup audio service on unmount
  useEffect(() => {
    const audioService = audioServiceRef.current;
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      audioService.dispose();
    };
  }, []);

  // Audio recording handlers
  const handleStartRecording = async () => {
    try {
      // Request permissions first
      const hasPermission = await audioServiceRef.current.requestPermissions();
      
      if (!hasPermission) {
        toast.error("Microphone Access Denied", {
          description: "Please enable microphone access in your browser settings to record audio. You can usually find this in your browser's site settings or permissions menu.",
        });
        return;
      }

      // Start recording
      await audioServiceRef.current.startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioLevel(0);

      // Start duration timer
      recordingIntervalRef.current = setInterval(() => {
        const duration = audioServiceRef.current.getRecordingDuration();
        setRecordingDuration(duration);
      }, 100);

      // Start audio level monitoring
      audioLevelIntervalRef.current = setInterval(() => {
        const level = audioServiceRef.current.getAudioLevel();
        setAudioLevel(level);
      }, 50);

      toast.success("Recording Started", {
        description: "Speak into your microphone. Click stop when you're done.",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Recording Failed", {
        description: error instanceof Error ? error.message : "Failed to start recording. Please try again.",
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      // Clear intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      // Stop recording and get blob
      const audioBlob = await audioServiceRef.current.stopRecording();
      setRecordedAudioBlob(audioBlob);
      setIsRecording(false);
      setAudioLevel(0);

      toast.success("Recording Stopped", {
        description: "Your audio has been recorded. You can play it back or record again.",
      });
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
      toast.error("Error Stopping Recording", {
        description: error instanceof Error ? error.message : "Failed to stop recording.",
      });
    }
  };

  const handlePlayAudio = async () => {
    if (!recordedAudioBlob) return;

    try {
      setIsPlayingAudio(true);
      await audioServiceRef.current.playAudio(recordedAudioBlob);
      
      // Audio ended, update state
      setTimeout(() => {
        setIsPlayingAudio(false);
      }, 100);
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsPlayingAudio(false);
      toast.error("Playback Failed", {
        description: "Failed to play audio. Please try recording again.",
      });
    }
  };

  const handleStopAudio = () => {
    audioServiceRef.current.stopAudio();
    setIsPlayingAudio(false);
  };

  const handleDeleteRecording = () => {
    audioServiceRef.current.stopAudio();
    setRecordedAudioBlob(null);
    setIsPlayingAudio(false);
    setRecordingDuration(0);
    setAudioLevel(0);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate each file before adding
    const validFiles: File[] = [];
    let validationError: string | undefined;
    
    for (const file of files) {
      const validation = FileService.validateFile(file);
      if (!validation.isValid) {
        validationError = validation.error;
        break;
      }
      validFiles.push(file);
    }
    
    if (validationError) {
      setErrors({ ...errors, files: validationError });
      toast.error("File Validation Error", {
        description: validationError,
      });
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
    setErrors({ ...errors, files: undefined });
    
    // Reset file input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFileUploadStatuses(prev => prev.filter((_, i) => i !== index));
  };

  const cancelUpload = () => {
    uploadCancelledRef.current = true;
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    // Validate title
    if (!title.trim()) {
      newErrors.title = "Title is required";
    }
    
    // Validate content
    if (!content.trim()) {
      newErrors.content = "Content is required";
    }
    
    // Validate unlock date
    if (!unlockDate) {
      newErrors.unlockDate = "Unlock date is required";
    } else if (unlockDate < new Date()) {
      newErrors.unlockDate = "Unlock date must be in the future";
    }
    
    // Validate files using FileService
    for (const file of selectedFiles) {
      const validation = FileService.validateFile(file);
      if (!validation.isValid) {
        newErrors.files = validation.error;
        break;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      toast.error("Validation Error", {
        description: "Please fix the errors in the form",
      });
      return;
    }
    
    // Check authentication
    if (!user || !userKey) {
      toast.error("Authentication Error", {
        description: "You must be logged in to create a capsule",
      });
      return;
    }

    setIsSubmitting(true);
    uploadCancelledRef.current = false;
    
    try {
      // Handle audio transcription if audio was recorded
      let finalContent = content;
      let audioFileToUpload: File | null = null;
      
      if (recordedAudioBlob) {
        try {
          // Transcribe audio
          toast.info("Transcribing Audio", {
            description: "Converting your voice message to text...",
          });
          
          const transcription = await aiService.transcribeAudio(recordedAudioBlob);
          
          // Append transcription to content
          if (transcription) {
            finalContent = content + (content ? '\n\n--- Audio Transcription ---\n\n' : '') + transcription;
          }
          
          // Convert blob to File for upload
          const audioFileName = `audio-${Date.now()}.${recordedAudioBlob.type.split('/')[1] || 'webm'}`;
          audioFileToUpload = new File([recordedAudioBlob], audioFileName, { 
            type: recordedAudioBlob.type 
          });
          
          toast.success("Transcription Complete", {
            description: "Your audio has been transcribed and will be saved with your capsule.",
          });
        } catch (transcriptionError) {
          console.error("Audio transcription failed:", transcriptionError);
          
          // Still save the audio file even if transcription fails
          const audioFileName = `audio-${Date.now()}.${recordedAudioBlob.type.split('/')[1] || 'webm'}`;
          audioFileToUpload = new File([recordedAudioBlob], audioFileName, { 
            type: recordedAudioBlob.type 
          });
          
          toast.error("Transcription Failed", {
            description: "Your audio will still be saved, but automatic transcription was not available.",
          });
        }
      }
      
      // Determine capsule type
      const type = selectedFiles.length > 0 || audioFileToUpload ? 
        (selectedFiles.some(f => f.type.startsWith('image/')) ? 'mixed' : 'text') : 
        'text';
      
      // Create capsule in database with transcribed content
      const capsuleId = await SecureCapsuleDB.createCapsule(
        title,
        finalContent,
        unlockDate!,
        type,
        userKey,
        user.id
      );
      
      // Combine selected files with audio file if present
      const allFilesToUpload = audioFileToUpload 
        ? [...selectedFiles, audioFileToUpload]
        : selectedFiles;
      
      // Upload files if any, with progress tracking
      if (allFilesToUpload.length > 0) {
        setIsUploadingFiles(true);
        
        // Initialize upload statuses
        const initialStatuses: FileUploadStatus[] = allFilesToUpload.map(file => ({
          file,
          progress: 0,
          status: 'pending' as const,
        }));
        setFileUploadStatuses(initialStatuses);
        
        try {
          // Upload files with progress tracking
          await FileService.uploadFiles(
            capsuleId,
            allFilesToUpload,
            userKey,
            user.id,
            (fileIndex: number, progress: number) => {
              // Check if upload was cancelled
              if (uploadCancelledRef.current) {
                throw new Error('Upload cancelled by user');
              }
              
              setFileUploadStatuses(prev => {
                const updated = [...prev];
                if (updated[fileIndex]) {
                  updated[fileIndex] = {
                    ...updated[fileIndex],
                    progress,
                    status: progress === 100 ? 'success' : 'uploading',
                  };
                }
                return updated;
              });
            }
          );
          
          setIsUploadingFiles(false);
        } catch (uploadError) {
          setIsUploadingFiles(false);
          
          // If upload was cancelled, preserve form data
          if (uploadCancelledRef.current) {
            toast.error("Upload Cancelled", {
              description: "File upload was cancelled. Your capsule text has been saved, but files were not uploaded.",
            });
            
            // Mark failed uploads
            setFileUploadStatuses(prev => 
              prev.map(status => 
                status.status !== 'success' 
                  ? { ...status, status: 'error' as const, error: 'Upload cancelled' }
                  : status
              )
            );
            
            // Don't navigate away - preserve form data
            setIsSubmitting(false);
            return;
          }
          
          // Handle other upload errors
          console.error("Error uploading files:", uploadError);
          
          // Mark failed uploads
          setFileUploadStatuses(prev => 
            prev.map(status => 
              status.status !== 'success' 
                ? { ...status, status: 'error' as const, error: uploadError instanceof Error ? uploadError.message : 'Upload failed' }
                : status
            )
          );
          
          toast.error("File Upload Error", {
            description: "Your capsule was created, but some files failed to upload. You can try uploading them again.",
          });
          
          // Don't navigate away - allow user to retry
          setIsSubmitting(false);
          return;
        }
      }
      
      // Trigger AI sentiment analysis after capsule creation (using final content with transcription)
      try {
        const analysis = await aiService.analyzeCapsuleContent(finalContent);
        
        // Store sentiment analysis results in Firestore
        await SecureCapsuleDB.updateCapsuleSentiment(
          capsuleId,
          analysis.sentiment,
          analysis.sentimentScore,
          analysis.themes,
          analysis.summary,
          userKey
        );
      } catch (aiError) {
        // AI analysis failure should not prevent capsule creation
        console.error("AI sentiment analysis failed:", aiError);
        // Continue without showing error to user - this is a non-critical feature
      }
      
      // Show success message
      toast.success("Success!", {
        description: "Your time capsule has been created and will unlock on " + format(unlockDate!, "MMMM d, yyyy"),
      });
      
      // Navigate back to dashboard
      onBack();
    } catch (error) {
      console.error("Error creating capsule:", error);
      
      // Show error message
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Failed to create capsule. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors({ ...errors, title: undefined });
                  }}
                  className={cn(
                    "border-gray-200 focus:border-amber-400 focus:ring-amber-400",
                    errors.title && "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                  required
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title}</p>
                )}
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
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (errors.content) setErrors({ ...errors, content: undefined });
                  }}
                  className={cn(
                    "min-h-[200px] border-gray-200 focus:border-amber-400 focus:ring-amber-400 resize-none",
                    errors.content && "border-red-500 focus:border-red-500 focus:ring-red-500"
                  )}
                  required
                />
                {errors.content && (
                  <p className="text-sm text-red-500">{errors.content}</p>
                )}
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
                        !unlockDate && "text-muted-foreground",
                        errors.unlockDate && "border-red-500"
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
                      onSelect={(date) => {
                        setUnlockDate(date);
                        // Validate date immediately on selection
                        if (date && date < new Date()) {
                          setErrors({ ...errors, unlockDate: "Unlock date must be in the future" });
                        } else if (errors.unlockDate) {
                          setErrors({ ...errors, unlockDate: undefined });
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {errors.unlockDate && (
                  <p className="text-sm text-red-500">{errors.unlockDate}</p>
                )}
                <p className="text-sm text-gray-500">
                  Choose a meaningful date - your birthday, graduation, new year, or just when you think you'll need this message.
                </p>
              </div>

              {/* Audio Recording */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">
                  Record Audio Message (Optional)
                </Label>
                <div className="border-2 border-gray-200 rounded-lg p-6">
                  {!isRecording && !recordedAudioBlob && (
                    <div className="text-center space-y-3">
                      <Button
                        type="button"
                        onClick={handleStartRecording}
                        disabled={isSubmitting || isUploadingFiles}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Start Recording
                      </Button>
                      <p className="text-sm text-gray-500">
                        Record a voice message to include with your capsule
                      </p>
                    </div>
                  )}

                  {isRecording && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-gray-700">Recording</span>
                          </div>
                          <span className="text-lg font-mono text-gray-800">
                            {formatDuration(recordingDuration)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          onClick={handleStopRecording}
                          className="bg-gray-700 hover:bg-gray-800 text-white"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop Recording
                        </Button>
                      </div>

                      {/* Audio Level Meter */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>Audio Level</span>
                          <span>{audioLevel}%</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-100 rounded-full",
                              audioLevel < 30 && "bg-green-500",
                              audioLevel >= 30 && audioLevel < 70 && "bg-yellow-500",
                              audioLevel >= 70 && "bg-red-500"
                            )}
                            style={{ width: `${audioLevel}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {recordedAudioBlob && !isRecording && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              Audio Recorded
                            </p>
                            <p className="text-xs text-gray-500">
                              Duration: {formatDuration(recordingDuration)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!isPlayingAudio ? (
                            <Button
                              type="button"
                              onClick={handlePlayAudio}
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Play
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={handleStopAudio}
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                          )}
                          <Button
                            type="button"
                            onClick={handleDeleteRecording}
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleStartRecording}
                        variant="outline"
                        className="w-full"
                        disabled={isSubmitting || isUploadingFiles}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Record Again
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">
                  Add Photos or Files (Optional)
                </Label>
                <div className={cn(
                  "border-2 border-dashed border-gray-200 rounded-lg p-6 text-center",
                  errors.files && "border-red-500",
                  isUploadingFiles && "opacity-50 pointer-events-none"
                )}>
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.txt,.md,.doc,.docx,audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploadingFiles}
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700">
                      Click to upload files
                    </span>
                    <span className="text-gray-600"> or drag and drop</span>
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Images, videos, PDFs, documents, audio, or text files
                  </p>
                </div>
                {errors.files && (
                  <p className="text-sm text-red-500">{errors.files}</p>
                )}

                {/* Selected Files with Upload Progress */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">
                        {isUploadingFiles ? 'Uploading Files...' : 'Selected Files:'}
                      </h4>
                      {isUploadingFiles && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={cancelUpload}
                          className="text-red-500 hover:text-red-700"
                        >
                          Cancel Upload
                        </Button>
                      )}
                    </div>
                    {selectedFiles.map((file, index) => {
                      const uploadStatus = fileUploadStatuses[index];
                      const showProgress = uploadStatus && (uploadStatus.status === 'uploading' || uploadStatus.status === 'success' || uploadStatus.status === 'error');
                      
                      return (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {uploadStatus?.status === 'success' && (
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              )}
                              {uploadStatus?.status === 'error' && (
                                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-700 truncate">{file.name}</span>
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            {!isUploadingFiles && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700 flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          {/* Progress Bar */}
                          {showProgress && (
                            <div className="space-y-1">
                              <Progress 
                                value={uploadStatus.progress} 
                                className={cn(
                                  "h-2",
                                  uploadStatus.status === 'error' && "bg-red-100"
                                )}
                              />
                              <div className="flex items-center justify-between text-xs">
                                <span className={cn(
                                  "text-gray-600",
                                  uploadStatus.status === 'success' && "text-green-600",
                                  uploadStatus.status === 'error' && "text-red-600"
                                )}>
                                  {uploadStatus.status === 'success' && 'Upload complete'}
                                  {uploadStatus.status === 'uploading' && `Uploading... ${uploadStatus.progress}%`}
                                  {uploadStatus.status === 'error' && (uploadStatus.error || 'Upload failed')}
                                </span>
                                {uploadStatus.status === 'uploading' && (
                                  <span className="text-gray-500">{uploadStatus.progress}%</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={!title || !content || !unlockDate || isSubmitting || isUploadingFiles || Object.keys(errors).length > 0}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3"
                >
                  {isUploadingFiles 
                    ? "Uploading Files..." 
                    : isSubmitting 
                    ? "Creating Your Time Capsule..." 
                    : "Create Time Capsule"}
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
