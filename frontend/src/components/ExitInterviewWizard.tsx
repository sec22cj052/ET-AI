import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Send, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';

interface ExitInterviewWizardProps {
  equipmentId: string;
  equipmentType: string;
  onClose: () => void;
}

export default function ExitInterviewWizard({ equipmentId, equipmentType, onClose }: ExitInterviewWizardProps) {
  const [prompts, setPrompts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/tacit-knowledge/exit-interview-template/${equipmentType}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setPrompts(data.prompts);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPrompts();
  }, [equipmentType]);

  const handleNext = () => {
    if (currentStep < prompts.length - 1) {
      setCurrentStep(curr => curr + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const answersArray = prompts.map((q, i) => ({
      question: q,
      answer: answers[i] || ''
    }));

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/tacit-knowledge/exit-interview-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          equipment_id: equipmentId,
          contributor_name: user?.full_name || 'Anonymous',
          contributor_role: user?.role || 'operator',
          answers: answersArray
        })
      });

      if (res.ok) {
        setIsDone(true);
      } else {
        alert("Failed to submit exit interview.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full text-center mx-auto border border-gray-200">
        <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
        <h2 className="text-xl font-bold mb-2">Thank you!</h2>
        <p className="text-gray-600 mb-6">Your invaluable field insights have been captured and added to the knowledge graph for future generations.</p>
        <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">Close</button>
      </div>
    );
  }

  if (prompts.length === 0) return <div>Loading template...</div>;

  const currentPrompt = prompts[currentStep];

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full mx-auto border border-gray-200 relative">
      <div className="mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="text-blue-600" />
          Exit Interview: Tacit Knowledge Capture
        </h2>
        <p className="text-sm text-gray-500 mt-1">Capture your unwritten field experience for {equipmentType}.</p>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
          <span>Question {currentStep + 1} of {prompts.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
          <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${((currentStep + 1) / prompts.length) * 100}%` }}></div>
        </div>

        <h3 className="text-md font-semibold text-gray-800 mb-4">{currentPrompt}</h3>
        <textarea
          value={answers[currentStep] || ''}
          onChange={(e) => setAnswers(prev => ({ ...prev, [currentStep]: e.target.value }))}
          className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] text-sm"
          placeholder="Share your insights..."
        />
      </div>

      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 text-sm font-medium"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        {currentStep < prompts.length - 1 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 bg-gray-100 text-gray-800 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Send size={16} /> Submit Insights
          </button>
        )}
      </div>
    </div>
  );
}
