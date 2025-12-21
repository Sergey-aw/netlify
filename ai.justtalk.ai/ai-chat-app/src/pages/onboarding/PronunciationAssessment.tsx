import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Volume2, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getRandomPronunciationText } from '@/data/pronunciation-texts';
import { scorePronunciation, type PronunciationResult } from '@/lib/speechace-api';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import Logo from '@/assets/logo.svg';

export default function PronunciationAssessment() {
  const navigate = useNavigate();
  const [currentText] = useState(() => getRandomPronunciationText());
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [showAllWords, setShowAllWords] = useState(false);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzeRecording = async () => {
    if (!audioBlob) return;

    setIsAnalyzing(true);
    setError('');

    // Simulate 5 second loading time
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const [analysisResult] = await Promise.all([
        scorePronunciation(audioBlob, currentText.text),
        minLoadTime
      ]);
      
      setResult(analysisResult);
    } catch (err) {
      setError('Failed to analyze pronunciation. Please try again.');
      console.error('Error analyzing pronunciation:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContinue = () => {
    // Update onboarding state and continue to email entry
    updateOnboardingStep('email-entry');
    navigate('/login');
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-700';
    if (score >= 75) return 'bg-yellow-100 text-yellow-700';
    if (score >= 60) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  if (result) {
    return (
      <div className="h-screen bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.8)_0%,rgba(239,246,255,0.2)_50%,white_100%)] flex items-center justify-center p-6">
        <div className="w-full h-full max-w-md flex flex-col justify-between py-4">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={Logo} alt="JustTalk" className="h-8" />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center overflow-y-auto">
            <div className="text-center px-4 mb-8">
              <h1 className="text-4xl font-semibold text-[#39597D] leading-tight mb-4 font-din">
                Assessment Results
              </h1>
              <p className="text-lg font-medium text-[#5983B3]">
                Your pronunciation analysis is complete
              </p>
            </div>

            {/* Top Scores */}
            <div className="grid grid-cols-2 gap-4 px-2 mb-6">
              {/* CEFR Level */}
              <div className="bg-white rounded-3xl p-6 text-center shadow-md">
                <div className="text-purple-600 font-semibold text-sm mb-2">
                  CEFR Level
                </div>
                <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-3xl font-bold text-purple-700">{result.cefrLevel}</span>
                </div>
                <p className="text-xs text-gray-600">
                  Pronunciation level
                </p>
              </div>

              {/* Overall Score */}
              <div className="bg-white rounded-3xl p-6 text-center shadow-md">
                <div className="text-blue-600 font-semibold text-sm mb-2">
                  Overall Score
                </div>
                <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-3xl font-bold text-blue-700">{result.overallScore}</span>
                </div>
                <p className="text-xs text-gray-600">
                  Out of 100 points
                </p>
              </div>
            </div>

            {/* Accuracy Summary */}
            <div className="px-2 mb-6">
              <div className="bg-white rounded-3xl p-6 shadow-md">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">
                      {result.correctWords} of {result.totalWords} words correct
                    </p>
                    <p className="text-sm text-gray-600">
                      {result.accuracy}% accuracy
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {result.accuracy}%
                  </div>
                </div>
              </div>
            </div>

            {/* Words to Improve */}
            {result.wordsToImprove.length > 0 && (
              <div className="px-2 mb-4">
                <div className="bg-white rounded-3xl p-6 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Words to Improve
                      </p>
                      <p className="text-sm text-gray-600">
                        {result.wordsToImprove.length} words need attention
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllWords(!showAllWords)}
                      className="flex items-center gap-1"
                    >
                      {showAllWords ? 'Show less' : 'Show all'}
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAllWords ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(showAllWords 
                      ? result.allWords 
                      : result.wordsToImprove.slice(0, 3)
                    ).map((word, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-b-0">
                        <span className="text-gray-900">{word.word}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getScoreBadgeColor(word.score)}`}>
                          {word.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Continue Button */}
          <div className="pt-6 px-2">
            <Button
              onClick={handleContinue}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-2xl text-lg font-semibold shadow-lg"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="h-screen bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.8)_0%,rgba(239,246,255,0.2)_50%,white_100%)] flex items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col items-center">
          <img src={Logo} alt="JustTalk" className="h-8 mb-12" />
          <div className="bg-white rounded-3xl p-12 shadow-md text-center">
            <Loader2 className="h-16 w-16 animate-spin text-purple-600 mb-4 mx-auto" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Your Pronunciation</h3>
            <p className="text-gray-600">
              Our AI is evaluating your recording...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.8)_0%,rgba(239,246,255,0.2)_50%,white_100%)] flex items-center justify-center p-6">
      <div className="w-full h-full max-w-md flex flex-col justify-between py-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={Logo} alt="JustTalk" className="h-8" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center px-4 mb-8">
            <h1 className="text-4xl font-semibold text-[#39597D] leading-tight mb-4 font-din">
              Pronunciation Assessment
            </h1>
            <p className="text-lg font-medium text-[#5983B3]">
              Read the text below out loud
            </p>
          </div>

          {/* Text to Read */}
          <div className="px-2 mb-6">
            <div className="bg-white rounded-3xl p-6 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Read this text:</h3>
                <Volume2 className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-lg leading-relaxed text-gray-800 mb-3">
                {currentText.text}
              </p>
              <p className="text-sm text-gray-500 italic">
                {currentText.description}
              </p>
            </div>
          </div>

          {/* Recording Controls */}
          <div className="px-2 space-y-4">
            {!audioBlob ? (
              <div className="space-y-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  size="lg"
                  className={`w-full py-7 rounded-2xl text-lg font-semibold shadow-lg ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="mr-2 h-5 w-5" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="mr-2 h-5 w-5" />
                      Start Recording
                    </>
                  )}
                </Button>
                {isRecording && (
                  <div className="flex items-center justify-center gap-2 text-red-600">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                    <span className="font-medium">Recording in progress...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-4 shadow-md">
                  <p className="text-green-800 font-medium flex items-center gap-2 justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                    Recording complete!
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setAudioBlob(null)}
                    variant="outline"
                    className="flex-1 py-6 rounded-2xl font-semibold"
                  >
                    Record Again
                  </Button>
                  <Button
                    onClick={analyzeRecording}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 py-6 rounded-2xl font-semibold"
                  >
                    Analyze
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-white rounded-3xl p-4 shadow-md">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Tips */}
            <div className="bg-white rounded-3xl p-4 shadow-md">
              <p className="text-sm text-gray-700 text-center">
                <strong>Tip:</strong> Find a quiet place and speak clearly at a natural pace
              </p>
            </div>
          </div>
        </div>

        {/* Skip Button */}
        <div className="pt-6 px-2">
          <Button
            onClick={() => navigate('/login')}
            variant="ghost"
            className="w-full text-gray-600 hover:text-gray-900"
          >
            Skip Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}
