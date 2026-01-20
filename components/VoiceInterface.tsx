
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type } from '@google/genai';
import { PersonaConfig, PitchContext, GroundingSource } from '../types';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import Tooltip from './Tooltip';

interface VoiceInterfaceProps {
  persona: PersonaConfig;
  context: PitchContext;
  onEnd: (history: {role: 'user' | 'model', text: string}[]) => void;
  onQuit: () => void;
}

const JARGON_LIST = [
  'synergy', 'viral loop', 'game changer', 'paradigm shift', 'bleeding edge', 
  'disruptive', 'hyper-growth', 'leveraging', 'low hanging fruit', 'mission critical',
  'next-gen', 'best-of-breed', 'scalable', 'ecosystem', 'holistic'
];

const FILLER_WORDS = ['um', 'uh', 'like', 'actually', 'basically', 'you know', 'sort of'];

const CONFIDENCE_POWER_WORDS = ['absolutely', 'definitely', 'guaranteed', 'proven', 'massive', 'leader', 'expert', 'scaling', 'unique'];
const HESITATION_WORDS = ['maybe', 'kinda', 'sort of', 'i guess', 'hopefully', 'trying to', 'sorry', 'if only'];

type PitchSentiment = 'Neutral' | 'Confident' | 'Nervous' | 'Aggressive' | 'Steady';

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ persona, context, onEnd, onQuit }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [volume, setVolume] = useState(0);
  
  // Real-time metrics
  const [jargonCount, setJargonCount] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [monologueWarning, setMonologueWarning] = useState(false);
  const [lastJargonFound, setLastJargonFound] = useState<string | null>(null);

  // Sentiment & Confidence
  const [confidenceScore, setConfidenceScore] = useState(70);
  const [currentSentiment, setCurrentSentiment] = useState<PitchSentiment>('Steady');

  // Real-time slide state
  const [currentSlide, setCurrentSlide] = useState<{ title: string, content: string[] } | null>(null);
  const [isUpdatingSlide, setIsUpdatingSlide] = useState(false);

  // URL / Grounding State
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptRef = useRef<{role: 'user' | 'model', text: string}[]>([]);
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');
  const lastAnalyzedTurnIndex = useRef(-1);
  const volumeHistoryRef = useRef<number[]>([]);
  const isPausedRef = useRef(false);

  useEffect(() => {
    startSession();
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (transcript.length > lastAnalyzedTurnIndex.current + 2) {
      if (context.pdfData) updateCurrentSlide();
      factCheckPitch(); 
      lastAnalyzedTurnIndex.current = transcript.length;
    }
  }, [transcript]);

  const factCheckPitch = async () => {
    if (transcript.length === 0 || isSearching) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const lastFounderMessage = transcript.filter(t => t.role === 'user').slice(-1)[0]?.text;
      if (!lastFounderMessage) return;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Fact check the following claim from a startup founder in the ${context.industry} space: "${lastFounderMessage}". Provide a quick analysis and relevant source URLs.`,
        config: {
          tools: [{ googleSearch: {} }]
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const newSources: GroundingSource[] = [];
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            newSources.push({
              title: chunk.web.title || "Found Source",
              uri: chunk.web.uri
            });
          }
        });
        
        setGroundingSources(prev => {
          const combined = [...newSources, ...prev];
          return combined.filter((v, i, a) => a.findIndex(t => (t.uri === v.uri)) === i).slice(0, 5);
        });
      }
    } catch (err) {
      console.error("Fact check failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const updateCurrentSlide = async () => {
    if (!context.pdfData || isUpdatingSlide) return;
    setIsUpdatingSlide(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const historyStr = transcript.slice(-4).map(t => `${t.role}: ${t.text}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: context.pdfData } },
            { text: `Based on this conversation for a ${context.industry} startup:\n"${historyStr}"\n\nWhich slide from the PDF is most relevant? Extract the title and bullet points.` }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['title', 'content']
          }
        }
      });

      if (response.text) {
        const slideData = JSON.parse(response.text);
        setCurrentSlide(slideData);
      }
    } catch (err) {
      console.error("Slide update failed", err);
    } finally {
      setIsUpdatingSlide(false);
    }
  };

  const analyzeRealTimeSpeech = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.length > 250) setMonologueWarning(true);
    else setMonologueWarning(false);

    let confidenceDelta = 0;
    JARGON_LIST.forEach(word => {
      if (lowerText.includes(word) && !currentInputTransRef.current.toLowerCase().includes(word)) {
        setJargonCount(prev => prev + 1);
        setLastJargonFound(word);
        confidenceDelta -= 5;
        setTimeout(() => setLastJargonFound(null), 3000);
      }
    });

    FILLER_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches && matches.length > (currentInputTransRef.current.toLowerCase().match(regex)?.length || 0)) {
        setFillerCount(prev => prev + 1);
        confidenceDelta -= 3;
      }
    });

    CONFIDENCE_POWER_WORDS.forEach(word => {
      if (lowerText.includes(word) && !currentInputTransRef.current.toLowerCase().includes(word)) confidenceDelta += 8;
    });
    HESITATION_WORDS.forEach(word => {
      if (lowerText.includes(word) && !currentInputTransRef.current.toLowerCase().includes(word)) confidenceDelta -= 6;
    });

    setConfidenceScore(prev => {
      const next = Math.max(10, Math.min(100, prev + confidenceDelta));
      if (next > 85) setCurrentSentiment('Confident');
      else if (next < 40) setCurrentSentiment('Nervous');
      else if (next > 70) setCurrentSentiment('Steady');
      else setCurrentSentiment('Neutral');
      return next;
    });
  };

  const startSession = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputAudioContext = new AudioContext({ sampleRate: 16000 });
      const outputAudioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } },
          },
          systemInstruction: `
            ROLE: ${persona.instruction}
            SECTOR CONTEXT: The startup is in the ${context.industry} sector. 
            INDUSTRY HURDLES:
            - If Biotech: Query IP landscape, FDA pathway, clinical trial design, and manufacturing partners.
            - If Enterprise SaaS: Query NDR (Net Dollar Retention), sales velocity, Magic Number, and logo churn.
            - If Hardware: Query Bill-of-Materials (BOM), supply chain resilience, and inventory risk.
            - If Fintech: Query compliance, fraud prevention, and interchange/take rates.
            
            BEHAVIORAL TRAITS: ${persona.traits.join(', ')}
            LANGUAGES SUPPORTED: ${persona.languages?.join(', ') || 'English'}
            
            EXTREME UNPREDICTABILITY PROTOCOLS:
            1. AGGRESSIVE DISRUPTION: If the founder monologues for more than 15 seconds, interrupt them immediately.
            2. NON-LINEAR PIVOTS: Abandon the pitch deck if you find a weakness in the ${context.industry} business model.
            3. DOMAIN DRILL-DOWN: If the sector is ${context.industry}, pick ONE technical hurdle and drill down for 3 minutes.
            
            CALL CONTEXT:
            Startup: ${context.startupName}
            Target: ${context.targetAmount}
            Summary: ${context.deckSummary}
            
            START: Begin the call with a direct, sector-specific opening. Example: "Thanks for joining. I've looked at the ${context.industry} landscape and it's crowded. Why is ${context.startupName} going to win? Go."
          `,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [{ googleSearch: {} }] 
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isPausedRef.current) {
                setVolume(0);
                return;
              }
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const curVol = Math.sqrt(sum / inputData.length);
              setVolume(curVol);
              
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = { 
                data: encode(new Uint8Array(int16.buffer)), 
                mimeType: 'audio/pcm;rate=16000' 
              };
              
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (isPausedRef.current && message.serverContent?.modelTurn) return;

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
              const source = outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContext.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              analyzeRealTimeSpeech(text);
              currentInputTransRef.current += text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTransRef.current += message.serverContent.outputTranscription.text;
            }
            
            if (message.serverContent?.turnComplete) {
              if (currentInputTransRef.current) {
                transcriptRef.current.push({ role: 'user', text: currentInputTransRef.current });
                currentInputTransRef.current = '';
                setMonologueWarning(false);
              }
              if (currentOutputTransRef.current) {
                transcriptRef.current.push({ role: 'model', text: currentOutputTransRef.current });
                currentOutputTransRef.current = '';
              }
              setTranscript([...transcriptRef.current]);
            }
          },
          onerror: (e) => console.error("Live API Error", e),
          onclose: () => setIsActive(false),
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Session start failed", err);
    }
  };

  const handleEnd = () => {
    if (sessionRef.current) sessionRef.current.close();
    onEnd(transcript);
  };

  const togglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (nextPaused) {
      sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      sessionRef.current?.sendRealtimeInput({ parts: [{ text: "[User has paused the call.]" }] });
    } else {
      sessionRef.current?.sendRealtimeInput({ parts: [{ text: "[User has returned. Resume.]" }] });
    }
  };

  return (
    <div className="w-full max-w-[95vw] h-[90vh] flex gap-6 p-4">
      {/* Sidebar Metrics */}
      <div className="w-80 flex flex-col gap-4 animate-in slide-in-from-left-4 duration-500">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex-1 flex flex-col gap-6 backdrop-blur-xl overflow-y-auto scrollbar-hide">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Sector: {context.industry}</h3>
          
          <div className="space-y-6">
            <div className="space-y-3">
               <div className="flex justify-between items-end">
                 <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Pitch Vibe</span>
                 <span className={`text-xs font-black uppercase ${
                   currentSentiment === 'Confident' ? 'text-green-500' :
                   currentSentiment === 'Nervous' ? 'text-red-500' :
                   currentSentiment === 'Steady' ? 'text-indigo-400' : 'text-zinc-400'
                 }`}>
                   {currentSentiment}
                 </span>
               </div>
               <div className="relative h-4 w-full bg-zinc-800 rounded-full p-0.5 overflow-hidden border border-zinc-700/50">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      confidenceScore > 80 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                      confidenceScore > 50 ? 'bg-gradient-to-r from-indigo-500 to-purple-400' :
                      'bg-gradient-to-r from-orange-500 to-red-400'
                    }`}
                    style={{ width: `${confidenceScore}%` }}
                  />
               </div>
            </div>

            {/* Grounding Sources Panel */}
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Industry Analysis</span>
                {isSearching && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
              </div>
              <div className="space-y-2">
                {groundingSources.length > 0 ? (
                  groundingSources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-3 bg-black/40 border border-zinc-800 rounded-xl hover:border-indigo-500 transition-all animate-in fade-in slide-in-from-top-2"
                    >
                      <div className="text-[10px] font-bold text-indigo-400 truncate mb-1 uppercase tracking-tight">
                        {source.title}
                      </div>
                      <div className="text-[9px] text-zinc-500 truncate flex items-center gap-1">
                        {new URL(source.uri).hostname}
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="text-[10px] text-zinc-600 italic">Listening for domain-specific claims...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="flex-1 flex flex-col items-center justify-between p-8 bg-zinc-900/60 border border-zinc-800 rounded-[3rem] shadow-2xl overflow-hidden relative backdrop-blur-md">
        <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-orange-500' : isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-zinc-400 uppercase tracking-tighter">
            {isActive ? `Pitching in ${context.industry}` : 'Establishing Connection...'}
          </span>
        </div>

        <div className="absolute top-8 right-8 flex items-center gap-4">
          <button 
            onClick={onQuit}
            className="text-zinc-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            Quit Session
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
          <div className="flex w-full gap-8 items-center justify-center">
            {context.pdfData && (
              <div className="w-1/2 aspect-video bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
                 {currentSlide ? (
                  <div className="h-full flex flex-col animate-in fade-in zoom-in duration-500">
                    <h4 className="text-lg font-black text-indigo-400 mb-4 heading-font border-b border-zinc-700 pb-2 uppercase tracking-wide">
                      {currentSlide.title}
                    </h4>
                    <ul className="space-y-3 flex-1">
                      {currentSlide.content.map((point, i) => (
                        <li key={i} className="text-xs text-zinc-300 flex gap-2">
                          <span className="text-indigo-500 font-bold">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs italic">
                    Analyzing deck context...
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col items-center justify-center">
              <div className="relative">
                 <div 
                   className={`w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-700 flex items-center justify-center relative z-10 transition-all duration-150`}
                   style={{ transform: !isPaused ? `scale(${1 + volume * 2.5})` : undefined }}
                 >
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                       {isPaused ? (
                         <div className="w-6 h-6 bg-orange-600 rounded-sm" />
                       ) : (
                         <div className="w-8 h-8 bg-black rounded-full" />
                       )}
                    </div>
                 </div>
              </div>
              <div className="mt-4 text-[10px] text-zinc-500 font-black uppercase tracking-widest">{persona.name}</div>
            </div>
          </div>

          <div className="w-full max-w-3xl bg-black/40 rounded-3xl p-6 h-48 overflow-y-auto flex flex-col-reverse space-y-reverse space-y-3 border border-zinc-800/50 scrollbar-hide backdrop-blur-md relative">
            {isPaused && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl animate-in fade-in duration-300">
                <span className="text-orange-500 font-black uppercase tracking-[0.3em] text-sm animate-pulse">Call Paused</span>
              </div>
            )}
            {[...transcript].reverse().map((turn, i) => (
              <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-[13px] leading-relaxed ${
                  turn.role === 'user' 
                    ? 'bg-indigo-600 text-white border border-white/10' 
                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
                }`}>
                  {turn.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full flex justify-center gap-4 pt-6">
          <button 
            onClick={togglePause}
            className={`px-8 py-4 font-bold rounded-full transition-all border ${
              isPaused ? 'text-orange-500 border-orange-500/50' : 'text-zinc-400 border-zinc-700'
            }`}
          >
            {isPaused ? 'Resume Call' : 'Pause Call'}
          </button>
          
          <button 
            onClick={handleEnd}
            className="px-10 py-4 bg-red-600/10 text-red-500 border border-red-500/50 font-bold rounded-full hover:bg-red-600 hover:text-white transition-all"
          >
            Hang Up & Analyze
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;
