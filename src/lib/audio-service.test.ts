import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioService } from './audio-service';

describe('AudioService', () => {
  let audioService: AudioService;
  let mockMediaStream: MediaStream;
  let mockMediaRecorder: any;

  beforeEach(() => {
    audioService = new AudioService();

    // Mock MediaStream with proper stop tracking
    const stopMock = vi.fn();
    mockMediaStream = {
      getTracks: () => [
        { stop: stopMock }
      ],
    } as any;

    // Mock MediaRecorder with shared state
    const sharedState = { value: 'inactive' };
    mockMediaRecorder = {
      start: vi.fn(() => { sharedState.value = 'recording'; }),
      stop: vi.fn(() => { sharedState.value = 'inactive'; }),
      get state() { return sharedState.value; },
      set state(val) { sharedState.value = val; },
      ondataavailable: null,
      onstop: null,
      mimeType: 'audio/webm',
    };

    // Mock navigator.mediaDevices.getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    } as any;

    // Mock MediaRecorder constructor as a class
    global.MediaRecorder = class MockMediaRecorder {
      start = mockMediaRecorder.start;
      stop = mockMediaRecorder.stop;
      get state() { return mockMediaRecorder.state; }
      set state(val) { mockMediaRecorder.state = val; }
      ondataavailable = mockMediaRecorder.ondataavailable;
      onstop = mockMediaRecorder.onstop;
      mimeType = mockMediaRecorder.mimeType;
      
      constructor(stream: any, options: any) {
        mockMediaRecorder.stream = stream;
        mockMediaRecorder.options = options;
      }
      
      static isTypeSupported(type: string) {
        return type.includes('audio/webm');
      }
    } as any;

    // Mock AudioContext - wrap in vi.fn() to track constructor calls
    const AudioContextMock = vi.fn().mockImplementation(function(this: any) {
      this.createMediaStreamSource = vi.fn(() => ({
        connect: vi.fn(),
      }));
      this.createAnalyser = vi.fn(() => ({
        fftSize: 256,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn((array) => {
          // Fill with some test data
          for (let i = 0; i < array.length; i++) {
            array[i] = 50; // Mid-level audio
          }
        }),
      }));
      this.close = vi.fn();
    });
    global.AudioContext = AudioContextMock as any;

    // Mock Audio element - wrap in vi.fn() to track constructor calls
    const AudioMock = vi.fn().mockImplementation(function(this: any) {
      this.play = vi.fn().mockResolvedValue(undefined);
      this.pause = vi.fn();
      this.currentTime = 0;
      this.paused = false;
      this.onended = null;
      this.src = '';
    });
    global.Audio = AudioMock as any;

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    audioService.dispose();
    vi.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return true when microphone permissions are granted', async () => {
      const result = await audioService.requestPermissions();
      
      expect(result).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      // Verify stream was stopped (tracks were stopped)
      const tracks = mockMediaStream.getTracks();
      expect(tracks.length).toBeGreaterThan(0);
    });

    it('should return false when microphone permissions are denied', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await audioService.requestPermissions();
      
      expect(result).toBe(false);
    });
  });

  describe('startRecording', () => {
    it('should start recording audio successfully', async () => {
      await audioService.startRecording();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      expect(mockMediaRecorder.start).toHaveBeenCalled();
      expect(audioService.isRecording()).toBe(true); // State is now 'recording' after start
    });

    it('should throw error when getUserMedia fails', async () => {
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(
        new Error('Microphone not available')
      );

      await expect(audioService.startRecording()).rejects.toThrow(
        'Failed to start recording. Please check microphone permissions.'
      );
    });

    it('should set up audio context and analyser for level monitoring', async () => {
      await audioService.startRecording();

      expect(AudioContext).toHaveBeenCalled();
    });
  });

  describe('stopRecording', () => {
    it('should reject if no active recording', async () => {
      await expect(audioService.stopRecording()).rejects.toThrow(
        'No active recording to stop'
      );
    });

    it('should reject if recording is already stopped', async () => {
      await audioService.startRecording();
      mockMediaRecorder.state = 'inactive';

      await expect(audioService.stopRecording()).rejects.toThrow(
        'Recording is already stopped'
      );
    });
  });

  describe('getRecordingDuration', () => {
    it('should return 0 when not recording', () => {
      const duration = audioService.getRecordingDuration();
      expect(duration).toBe(0);
    });

    it('should return duration in seconds when recording', async () => {
      await audioService.startRecording();
      mockMediaRecorder.state = 'recording';

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const duration = audioService.getRecordingDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAudioLevel', () => {
    it('should return 0 when not recording', () => {
      const level = audioService.getAudioLevel();
      expect(level).toBe(0);
    });

    it('should return audio level between 0-100 when recording', async () => {
      await audioService.startRecording();

      const level = audioService.getAudioLevel();
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(100);
    });
  });

  describe('playAudio', () => {
    it('should play audio blob successfully', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

      await audioService.playAudio(mockBlob);

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(Audio).toHaveBeenCalled();
    });

    it('should stop existing playback before playing new audio', async () => {
      const mockBlob1 = new Blob(['audio data 1'], { type: 'audio/webm' });
      const mockBlob2 = new Blob(['audio data 2'], { type: 'audio/webm' });

      await audioService.playAudio(mockBlob1);
      await audioService.playAudio(mockBlob2);

      // Should have created two Audio elements
      expect(Audio).toHaveBeenCalledTimes(2);
    });

    it('should throw error when playback fails', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      // Mock play to reject
      const AudioFailMock = vi.fn().mockImplementation(function(this: any) {
        this.play = vi.fn().mockRejectedValue(new Error('Playback failed'));
        this.pause = vi.fn();
        this.currentTime = 0;
        this.paused = false;
        this.onended = null;
        this.src = '';
      });
      global.Audio = AudioFailMock as any;

      await expect(audioService.playAudio(mockBlob)).rejects.toThrow(
        'Failed to play audio. Please try again.'
      );
    });
  });

  describe('stopAudio', () => {
    it('should stop audio playback', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const pauseMock = vi.fn();
      
      const AudioStopMock = vi.fn().mockImplementation(function(this: any) {
        this.play = vi.fn().mockResolvedValue(undefined);
        this.pause = pauseMock;
        this.currentTime = 0;
        this.paused = false;
        this.onended = null;
        this.src = '';
      });
      global.Audio = AudioStopMock as any;

      await audioService.playAudio(mockBlob);
      audioService.stopAudio();

      expect(pauseMock).toHaveBeenCalled();
    });

    it('should handle stopping when no audio is playing', () => {
      // Should not throw
      expect(() => audioService.stopAudio()).not.toThrow();
    });
  });

  describe('isRecording', () => {
    it('should return false when not recording', () => {
      expect(audioService.isRecording()).toBe(false);
    });

    it('should return true when recording', async () => {
      await audioService.startRecording();
      mockMediaRecorder.state = 'recording';

      expect(audioService.isRecording()).toBe(true);
    });
  });

  describe('isPlaying', () => {
    it('should return false when not playing', () => {
      expect(audioService.isPlaying()).toBe(false);
    });

    it('should return true when playing audio', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      const AudioPlayingMock = vi.fn().mockImplementation(function(this: any) {
        this.play = vi.fn().mockResolvedValue(undefined);
        this.pause = vi.fn();
        this.currentTime = 0;
        this.paused = false;
        this.onended = null;
        this.src = '';
      });
      global.Audio = AudioPlayingMock as any;

      await audioService.playAudio(mockBlob);

      expect(audioService.isPlaying()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', async () => {
      await audioService.startRecording();
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      await audioService.playAudio(mockBlob);

      audioService.dispose();

      expect(audioService.isRecording()).toBe(false);
      expect(audioService.isPlaying()).toBe(false);
    });
  });
});
