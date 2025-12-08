import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square, Loader2, Volume2, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getRandomPronunciationText } from '@/data/pronunciation-texts';
import { scorePronunciation, type PronunciationResult } from '@/lib/speechace-api';
import { updateOnboardingStep } from '@/lib/onboarding-state';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-2xl">Pronunciation Assessment Results</CardTitle>
            <CardDescription>Your pronunciation analysis is complete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Top Scores */}
            <div className="grid grid-cols-2 gap-4">
              {/* CEFR Level */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 text-center">
                <div className="text-purple-600 font-semibold text-sm mb-2">
                  CEFR Pronunciation Level
                </div>
                <div className="bg-purple-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2">
                  <span className="text-4xl font-bold text-purple-700">{result.cefrLevel}</span>
                </div>
                <p className="text-sm text-purple-700">
                  Your pronunciation aligns with {result.cefrLevel} level standards
                </p>
              </div>

              {/* Overall Score */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                <div className="text-blue-600 font-semibold text-sm mb-2">
                  Overall Pronunciation Score
                </div>
                <div className="bg-blue-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2">
                  <span className="text-4xl font-bold text-blue-700">{result.overallScore}</span>
                </div>
                <p className="text-sm text-blue-700">
                  Out of 100 points from AI analysis
                </p>
              </div>
            </div>

            {/* Word-Level Analysis */}
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="text-lg font-semibold">Word-Level Analysis</div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Individual pronunciation scores for each word
              </p>

              {/* Accuracy Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 mb-1">
                      You pronounced {result.correctWords} out of {result.totalWords} words correctly
                    </p>
                    <p className="text-sm text-gray-600">
                      That's {result.accuracy}% accuracy (Good and Excellent scores)
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {result.accuracy}%
                  </div>
                </div>
              </div>

              {/* Your Recording */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Your Recording:</p>
                <p className="text-gray-800 leading-relaxed">{result.transcript}</p>
              </div>

              {/* Color Guide */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Color Guide:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Excellent (90-100)
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    Good (75-89)
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    Fair (60-74)
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    Needs Work (&lt;60)
                  </span>
                </div>
              </div>

              {/* Words to Improve */}
              {result.wordsToImprove.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Words to Improve ({result.wordsToImprove.length})
                      </p>
                      <p className="text-sm text-gray-600">
                        Focus on these {result.wordsToImprove.length} words that need improvement
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllWords(!showAllWords)}
                      className="flex items-center gap-1"
                    >
                      Show all {result.totalWords} words
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAllWords ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Word</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllWords 
                          ? result.allWords 
                          : result.wordsToImprove.slice(0, 3)
                        ).map((word, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="px-4 py-3 text-gray-900">{word.word}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getScoreBadgeColor(word.score)}`}>
                                {word.score}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.wordsToImprove.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">
                    Excellent! All words were pronounced correctly.
                  </p>
                </div>
              )}
            </div>

            {/* Continue Button */}
            <Button onClick={handleContinue} className="w-full" size="lg">
              Continue to Next Step
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-16 w-16 animate-spin text-purple-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Your Pronunciation</h3>
            <p className="text-gray-600 text-center">
              Our AI is evaluating your recording. This will take a few seconds...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Pronunciation Assessment</CardTitle>
          <CardDescription>
            Read the text below out loud to help us assess your pronunciation level
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Text to Read */}
          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Read this text:</h3>
              <Volume2 className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-lg leading-relaxed text-gray-800">
              {currentText.text}
            </p>
            <p className="text-sm text-gray-500 mt-3 italic">
              {currentText.description}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="space-y-4">
            {!audioBlob ? (
              <div className="text-center space-y-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  size="lg"
                  className={`w-full ${isRecording ? 'bg-red-600 hover:bg-red-700' : ''}`}
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
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Recording complete! Ready to analyze.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setAudioBlob(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Record Again
                  </Button>
                  <Button
                    onClick={analyzeRecording}
                    className="flex-1"
                  >
                    Analyze Pronunciation
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Tips:</strong> Find a quiet place, speak clearly and at a natural pace. 
              Make sure your microphone is working properly.
            </p>
          </div>

          {/* Skip Button */}
          <div className="text-center">
            <Button
              onClick={() => navigate('/login')}
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
            >
              Skip Assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
