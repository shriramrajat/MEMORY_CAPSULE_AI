/**
 * AudioService - Handles audio recording and playback functionality
 * 
 * Features:
 * - Microphone permission management
 * - Audio recording using MediaRecorder API
 * - Recording duration tracking
 * - Audio level monitoring for visualization
 * - Audio playback functionality
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private animationFrameId: number | null = null;

  /**
   * Request microphone permissions from the user
   * Returns true if permissions are granted, false otherwise
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed to check permissions
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Start recording audio from the microphone
   * Throws an error if permissions are not granted or recording fails
   */
  async startRecording(): Promise<void> {
    try {
      // Get audio stream from microphone
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Set up audio context and analyser for level monitoring
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType
      });

      // Reset audio chunks
      this.audioChunks = [];

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start();
      this.recordingStartTime = Date.now();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw new Error('Failed to start recording. Please check microphone permissions.');
    }
  }

  /**
   * Stop recording and return the recorded audio as a Blob
   * Returns a promise that resolves with the audio Blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording to stop'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recording is already stopped'));
        return;
      }

      // Set up handler for when recording stops
      this.mediaRecorder.onstop = () => {
        try {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          this.cleanup();
          resolve(audioBlob);
        } catch (error) {
          reject(error);
        }
      };

      // Stop the recording
      this.mediaRecorder.stop();
    });
  }

  /**
   * Get the current recording duration in seconds
   * Returns 0 if not recording
   */
  getRecordingDuration(): number {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return 0;
    }
    return Math.floor((Date.now() - this.recordingStartTime) / 1000);
  }

  /**
   * Get the current audio level for visualization (0-100)
   * Returns 0 if not recording or no analyser available
   */
  getAudioLevel(): number {
    if (!this.analyser) {
      return 0;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;

    // Normalize to 0-100 range
    return Math.min(100, Math.round((average / 255) * 100));
  }

  /**
   * Play an audio blob
   * Returns a promise that resolves when playback starts
   */
  async playAudio(blob: Blob): Promise<void> {
    try {
      // Stop any existing playback
      this.stopAudio();

      // Create audio element
      this.audioElement = new Audio();
      const url = URL.createObjectURL(blob);
      this.audioElement.src = url;

      // Clean up URL when audio ends
      this.audioElement.onended = () => {
        URL.revokeObjectURL(url);
      };

      // Play audio
      await this.audioElement.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw new Error('Failed to play audio. Please try again.');
    }
  }

  /**
   * Stop audio playback
   */
  stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Check if currently playing audio
   */
  isPlaying(): boolean {
    return this.audioElement !== null && !this.audioElement.paused;
  }

  /**
   * Get a supported MIME type for MediaRecorder
   * Tries common formats and returns the first supported one
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback to default
    return 'audio/webm';
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Stop all tracks in the stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear analyser
    this.analyser = null;

    // Clear media recorder
    this.mediaRecorder = null;

    // Clear audio chunks
    this.audioChunks = [];

    // Cancel animation frame if exists
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Dispose of all resources
   * Should be called when the service is no longer needed
   */
  dispose(): void {
    this.stopAudio();
    this.cleanup();
  }
}
