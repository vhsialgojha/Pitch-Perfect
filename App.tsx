
import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { PERSONAS } from './constants';
import { InvestorPersona, PersonaConfig, PitchContext, FeedbackReport, TranscriptionTurn, SectorType } from './types';
import VoiceInterface from './components/VoiceInterface';
import PitchSetup from './components/PitchSetup';
import FeedbackScreen from './components/FeedbackScreen';
import Tooltip from './components/Tooltip';
import DemoPlayer from './components/DemoPlayer';

const App: React.FC = () => {
  const [step, setStep] = useState<'landing' | 'setup' | 'call' | 'feedback' | 'demo'>('landing');
  const [selectedPersona, setSelectedPersona] = useState<PersonaConfig>(PERSONAS[0]);
  const [pitchContext, setPitchContext] = useState<PitchContext>({
    startupName: '',
    targetAmount: '',
    deckSummary: '',
    industry: 'Enterprise SaaS',
    pdfData: undefined
  });
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);

  const handleStartSetup = () => setStep('setup');
  const handleStartDemo = () => setStep('demo');
  const handleGoHome = () => {
    setFeedback(null);
    setTranscriptionHistory([]);
    setStep('landing');
  };

  const handleStartCall = (persona: PersonaConfig, context: PitchContext) => {
    setSelectedPersona(persona);
    setPitchContext(context);
    setStep('call');
  };

  const handleEndCall = async (history: TranscriptionTurn[]) => {
    setTranscriptionHistory(history);
    setStep('feedback');
    await generateFeedback(history);
  };

  const generateFeedback = async (history: TranscriptionTurn[]) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analyze the following mock investor call transcript. Provide a detailed feedback report.
      Context: ${pitchContext.startupName} is raising ${pitchContext.targetAmount} in the ${pitchContext.industry} sector.
      Investor Style: ${selectedPersona.name}.
      
      Evaluate based on these four metrics (0-100):
      1. Conciseness: Did they monologue? Did they get to the point quickly?
      2. Data Readiness: Did they handle sector-specific numbers (if SaaS: NDR/LTV; if Biotech: Trial costs/IP; if Hardware: BOM/Margin) with precision?
      3. Confidence: Was their tone steady? Did they use filler words?
      4. Agility: How well did they handle sudden pivots or industry-specific deep dives?
      
      Coachability: Specifically evaluate how well the founder handled being challenged.
      
      Transcript:
      ${history.map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: { type: Type.NUMBER },
              coachabilityScore: { type: Type.NUMBER },
              metrics: {
                type: Type.OBJECT,
                properties: {
                  conciseness: {
                    type: Type.OBJECT,
                    properties: { 
                      score: { type: Type.NUMBER }, 
                      label: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ['score', 'label', 'description']
                  },
                  dataReadiness: {
                    type: Type.OBJECT,
                    properties: { 
                      score: { type: Type.NUMBER }, 
                      label: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ['score', 'label', 'description']
                  },
                  confidence: {
                    type: Type.OBJECT,
                    properties: { 
                      score: { type: Type.NUMBER }, 
                      label: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ['score', 'label', 'description']
                  },
                  agility: {
                    type: Type.OBJECT,
                    properties: { 
                      score: { type: Type.NUMBER }, 
                      label: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ['score', 'label', 'description']
                  }
                },
                required: ['conciseness', 'dataReadiness', 'confidence', 'agility']
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyQuestionsAsked: { type: Type.ARRAY, items: { type: Type.STRING } },
              advice: { type: Type.STRING }
            },
            required: ['overallScore', 'coachabilityScore', 'metrics', 'strengths', 'weaknesses', 'keyQuestionsAsked', 'advice']
          }
        }
      });

      if (response.text) {
        setFeedback(JSON.parse(response.text));
      }
    } catch (error) {
      console.error("Feedback generation failed", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#0a0a0a] to-[#1a1a1a] relative">
      {/* Persistent Global Home Navigation */}
      {step !== 'landing' && (
        <button 
          onClick={handleGoHome}
          className="absolute top-8 left-8 z-50 flex items-center gap-2 group transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-black text-xl shadow-lg shadow-white/5 group-hover:scale-110 transition-transform">
            P
          </div>
          <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            Home
          </span>
        </button>
      )}

      {step === 'landing' && (
        <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in duration-1000">
          <div className="space-y-4">
            <div className="inline-block px-4 py-1.5 mb-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
              The Founder's War Room
            </div>
            <h1 className="text-6xl md:text-8xl font-black heading-font tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600">
              PITCH PERFECT
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 font-light max-w-2xl mx-auto leading-relaxed">
              Investors back <span className="text-white font-medium">how you think</span>, not what's on your slides. Stop monologuing and start winning.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button 
              onClick={handleStartSetup}
              className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/20"
            >
              Start Drill Session
            </button>
            <button 
              onClick={handleStartDemo}
              className="px-8 py-4 border border-zinc-700 text-white font-bold rounded-full hover:bg-zinc-800 transition-all"
            >
              Watch the "Monologue" Mistake
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            {[
              { title: "Zero Lag", desc: "Native sub-second audio response. Like a real Zoom call.", tooltip: "Gemini 2.5 Flash Native Audio handles the heavy lifting." },
              { title: "Skeptic AI", desc: "Personas that interrupt, challenge, and hunt for flaws.", tooltip: "Models trained on thousands of VC decision frameworks." },
              { title: "Brutal Feedback", desc: "No fluff reports. We tell you exactly where you waffled.", tooltip: "Full transcript analysis for logic and data readiness." }
            ].map((item, idx) => (
              <Tooltip key={idx} content={item.tooltip}>
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm h-full text-left group hover:border-indigo-500/30 transition-colors">
                  <h3 className="font-bold text-lg mb-2 text-zinc-200 group-hover:text-white">{item.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {step === 'setup' && (
        <PitchSetup onStart={handleStartCall} onBack={handleGoHome} />
      )}

      {step === 'call' && (
        <VoiceInterface 
          persona={selectedPersona} 
          context={pitchContext} 
          onEnd={handleEndCall}
          onQuit={handleGoHome}
        />
      )}

      {step === 'feedback' && (
        <FeedbackScreen 
          feedback={feedback} 
          history={transcriptionHistory} 
          onRestart={handleGoHome} 
        />
      )}

      {step === 'demo' && (
        <DemoPlayer onBack={handleGoHome} />
      )}
    </div>
  );
};

export default App;
