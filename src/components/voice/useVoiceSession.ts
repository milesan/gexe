import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration for Hume AI
const HUME_CONFIG = {
  apiKey: process.env.REACT_APP_HUME_API_KEY || '',
  apiUrl: process.env.REACT_APP_HUME_API_URL || 'wss://api.hume.ai/v0/stream',
};

interface VoiceSessionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  currentResponse: string | null;
}

export function useVoiceSession() {
  const [state, setState] = useState<VoiceSessionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    currentResponse: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to Hume AI WebSocket
  const startSession = useCallback(async () => {
    if (state.isConnected || state.isConnecting) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Note: In production, you'd want to get an access token from your backend
      // to avoid exposing the API key in the frontend
      const ws = new WebSocket(`${HUME_CONFIG.apiUrl}?api_key=${HUME_CONFIG.apiKey}`);

      ws.onopen = () => {
        console.log('Connected to Hume AI');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));

        // Send initial configuration
        ws.send(JSON.stringify({
          type: 'session_settings',
          session_settings: {
            type: 'empathic_voice',
            empathic_voice: {
              voice_id: 'default', // You can customize this
              language: 'en-US',
            },
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleHumeMessage(data);
        } catch (error) {
          console.error('Error parsing Hume message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Hume WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection error. Please try again.',
        }));
      };

      ws.onclose = () => {
        console.log('Disconnected from Hume AI');
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            startSession();
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error starting Hume session:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to connect. Please check your connection.',
      }));
    }
  }, [state.isConnected, state.isConnecting]);

  // Handle messages from Hume AI
  const handleHumeMessage = (data: any) => {
    switch (data.type) {
      case 'audio_output':
        // Handle audio output from Hume
        if (data.audio_output?.content) {
          setState(prev => ({
            ...prev,
            currentResponse: data.audio_output.content,
          }));
        }
        break;

      case 'user_message':
        // Handle transcribed user message
        console.log('User said:', data.user_message);
        break;

      case 'assistant_message':
        // Handle assistant response
        console.log('Assistant response:', data.assistant_message);
        setState(prev => ({
          ...prev,
          currentResponse: data.assistant_message,
        }));
        break;

      case 'error':
        console.error('Hume error:', data.error);
        setState(prev => ({
          ...prev,
          error: data.error.message || 'An error occurred',
        }));
        break;

      default:
        console.log('Unknown Hume message type:', data.type);
    }
  };

  // Send a message to Hume AI
  const sendMessage = useCallback((message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'user_input',
      user_input: {
        text: message,
      },
    }));
  }, []);

  // Send audio data to Hume AI
  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    // Convert audio data to base64
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));

    wsRef.current.send(JSON.stringify({
      type: 'audio_input',
      audio_input: {
        data: base64Audio,
      },
    }));
  }, []);

  // End the session
  const endSession = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      currentResponse: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  return {
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    currentResponse: state.currentResponse,
    startSession,
    endSession,
    sendMessage,
    sendAudio,
  };
}

// Alternative implementation using native Web Speech API (fallback)
export function useNativeVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const speak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    speak,
  };
}