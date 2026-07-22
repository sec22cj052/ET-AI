import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Send, FileText } from 'lucide-react';

interface TacitCaptureWidgetProps {
  equipmentId: string;
  onSuccess?: () => void;
}

export default function TacitCaptureWidget({ equipmentId, onSuccess }: TacitCaptureWidgetProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  
  const recognitionRef = useRef<any>(null);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Your browser does not support the Web Speech API.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setText((prev) => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/tacit-knowledge/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          equipment_id: equipmentId,
          contributor_name: user?.full_name || 'Anonymous',
          contributor_role: user?.role || 'operator',
          content_text: text,
          capture_context: 'quick_capture',
          capture_method: 'text' // For now, even if voice was used, it's transcribed to text
        })
      });
      
      if (res.ok) {
        setText('');
        if (onSuccess) onSuccess();
      } else {
        alert('Failed to capture note.');
      }
    } catch (err) {
      console.error(err);
      alert('Error submitting note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mt-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <FileText size={16} className="text-blue-600" /> Add Field Insight
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Document unwritten knowledge, quirks, or observations..."
            className="w-full text-sm p-3 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]"
          />
          <button
            type="button"
            onClick={toggleRecording}
            className={`absolute right-2 top-2 p-1.5 rounded-md ${isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'} hover:bg-gray-200 transition-colors`}
            title={isRecording ? "Stop Recording" : "Start Voice Typing"}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            Notes are saved as <span className="font-semibold">Unverified</span> until peer-reviewed.
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !text.trim()}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={14} /> Submit
          </button>
        </div>
      </form>
    </div>
  );
}
