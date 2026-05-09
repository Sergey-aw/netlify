import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getRandomPronunciationText } from '@/data/pronunciation-texts';
import { scorePronunciation, type PronunciationResult } from '@/lib/speechsuper-api';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep, trackPronunciationAssessment } from '@/lib/posthog';
import { AudioRecorder } from '@/lib/audioRecorder';
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
  
  useEffect(() => {
    trackOnboardingStep('pronunciation', 'started');
  }, []);
  
  const audioRecorderRef = useRef<AudioRecorder | null>(null);

  const startRecording = async () => {
    try {
      // Initialize audio recorder (creates proper WAV format)
      const recorder = new AudioRecorder();
      await recorder.initialize();
      audioRecorderRef.current = recorder;

      recorder.startRecording();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone access.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = async () => {
    if (audioRecorderRef.current && isRecording) {
      try {
        // Stop recording and get WAV blob (16kHz, mono, PCM16)
        const wavBlob = await audioRecorderRef.current.stopRecording();
        setAudioBlob(wavBlob);
        
        // Clean up
        audioRecorderRef.current.cleanup();
        audioRecorderRef.current = null;
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('Failed to process recording. Please try again.');
      }
      setIsRecording(false);
    }
  };

  const analyzeRecording = async () => {
    if (!audioBlob) return;

    setIsAnalyzing(true);
    setError('');

    console.log('Analyzing audio:', {
      size: audioBlob.size,
      type: audioBlob.type,
    });

    // Simulate 5 second loading time
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const [analysisResult] = await Promise.all([
        scorePronunciation(audioBlob, currentText.text),
        minLoadTime
      ]);
      
      console.log('Analysis result:', analysisResult);
      setResult(analysisResult);
    } catch (err) {
      setError('Failed to analyze pronunciation. Please try again.');
      console.error('Error analyzing pronunciation:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContinue = () => {
    // Track completion with score
    if (result) {
      const qualityScore = (result as any).quality_score || 0;
      trackOnboardingStep('pronunciation', 'completed', {
        quality_score: qualityScore,
        fluency_score: (result as any).fluency_score,
        text_score: (result as any).text_score?.quality_score,
      });
      trackPronunciationAssessment(qualityScore, {
        fluency_score: (result as any).fluency_score,
        text_score: (result as any).text_score?.quality_score,
      });
    }
    
    // Update onboarding state and continue to age selection
    updateOnboardingStep('onboarding-age');
    navigate('/onboarding/age');
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
            <img src={Logo} alt="JustTalk" className="h-7" />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center overflow-y-auto">
            <div className="text-center px-4" style={{ minHeight: '80px', marginBottom: '14px' }}>
              {/* Title */}
              <div className="relative font-din overflow-hidden" style={{ height: '60px', marginBottom: '4px' }}>
                <h1 className="font-semibold text-[#39597D] leading-tight text-[clamp(1.4rem,4vw,2.25rem)]">
                  Assessment Results
                </h1>
              </div>
              
              {/* Subtitle */}
              <div className="relative overflow-hidden" style={{ height: '30px' }}>
                <p className="font-medium text-[#5983B3] text-[clamp(1rem,4vw,1.125rem)]">
                  Your pronunciation analysis is complete
                </p>
              </div>
            </div>

            {/* Top Scores */}
            <div className="grid grid-cols-2 gap-4 px-2 mb-6 mt-4">
              {/* CEFR Level */}
              <div className="bg-white rounded-3xl p-6 text-center shadow-md">
                <div className="text-purple-600 font-semibold text-sm mb-2">
                  CEFR Level
                </div>
                <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-purple-700">{result.cefrLevel}</span>
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
                  <span className="text-2xl font-bold text-blue-700">{result.overallScore}</span>
                </div>
                <p className="text-xs text-gray-600">
                  Out of 100 points
                </p>
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
                        <span className="text-gray-900 text-sm">{word.word}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreBadgeColor(word.score)}`}>
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
            <h3 className="font-semibold mb-2 text-[clamp(1.125rem,5vw,1.25rem)]">Analyzing Your Pronunciation</h3>
            <p className="text-gray-600 text-[clamp(0.875rem,3.5vw,1rem)]">
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
          <img src={Logo} alt="JustTalk" className="h-7" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center px-4" style={{ minHeight: '80px', marginBottom: '14px' }}>
            {/* Title */}
            <div className="relative font-din overflow-hidden" style={{ height: '60px', marginBottom: '4px' }}>
              <h1 className="font-semibold text-[#39597D] leading-tight text-[clamp(1.4rem,6vw,2.25rem)]">
                Pronunciation Assessment
              </h1>
            </div>
            
            {/* Subtitle */}
            <div className="relative overflow-hidden" style={{ height: '60px' }}>
              <p className="font-medium text-[#5983B3] text-[clamp(1rem,4vw,1.125rem)]">
                Read the text below out loud
              </p>
            </div>
          </div>

          {/* Text to Read */}
          <div className="px-2 mb-6">
            <div className="bg-white rounded-3xl p-6 shadow-md">
              
              <p className="text-base leading-normal text-gray-800 mb-0">
                {currentText.text}
              </p>
             
            </div>
          </div>

          {/* Tips */}
          {/* <div className="px-2 mb-4">
            <div className="bg-white rounded-3xl p-4 shadow-md">
              <p className="text-sm text-gray-700 text-center">
                <strong>Tip:</strong> Find a quiet place and speak clearly at a natural pace
              </p>
            </div>
          </div> */}

          {/* Recording Status */}
          {isRecording && (
            <div className="px-2 mb-4">
              <div className="flex items-center justify-center gap-2 text-red-600">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                <span className="font-medium">Recording in progress...</span>
              </div>
            </div>
          )}

          {audioBlob && (
            <div className="px-2 mb-4">
              <div className="bg-white rounded-3xl p-4 shadow-md">
                <p className="text-green-800 font-medium flex items-center gap-2 justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                  Recording complete!
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="px-2 mb-4">
              <div className="bg-white rounded-3xl p-4 shadow-md">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Skip Button Above Main Button */}
        {!audioBlob && !isRecording && (
          <div className="pt-6 px-2">
            <Button
              onClick={() => navigate('/onboarding/age')}
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-900"
            >
              Skip Assessment
            </Button>
          </div>
        )}

        {/* Bottom Action Button */}
        <div className="px-2">
          {!audioBlob ? (
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-7 rounded-2xl text-lg font-semibold shadow-lg ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
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
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={() => setAudioBlob(null)}
                variant="outline"
                className="flex-1 py-7 rounded-2xl text-lg font-semibold"
              >
                Record Again
              </Button>
              <Button
                onClick={analyzeRecording}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-7 rounded-2xl text-lg font-semibold shadow-lg"
              >
                Analyze
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
