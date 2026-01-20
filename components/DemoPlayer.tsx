
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface DemoPlayerProps {
  onBack: () => void;
}

const DemoPlayer: React.FC<DemoPlayerProps> = ({ onBack }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [activeSpeaker, setActiveSpeaker] = useState<'none' | 'founder' | 'investor'>('none');
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const demoScript = `
    Founder: (Energetic) Hi, I'm Sarah, and we are building Cloudly. We started three years ago when I was at Stanford and realized that cloud costs were just too high for most startups...
    Investor: (Interrupting) Sarah, Sarah—sorry to stop you. I've read the deck. What's your burn rate right now?
    Founder: Oh, well, we're actually focusing on user acquisition first, we have about five thousand...
    Investor: (Sharp) That wasn't the question. How many months of runway do you have left? 
    Founder: (Pauses) We have... about four months.
    Investor: Now we're having a real conversation. Continue.
  `;

  const playDemo = async () => {
    setStatus('loading');
    try {
      // Fix: Follow initialization guideline to use process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `TTS the following conversation between a Founder and an Investor. 
      Ensure the Investor sounds sharp and impatient, and the Founder sounds initially over-rehearsed but then caught off guard.
      
      Script:
      ${demoScript}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        // Fix: Simplified contents structure to match SDK examples
        contents: { parts: [{ text: prompt }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Founder',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                {
                  speaker: 'Investor',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
                }
              ]
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data received");

      // Fix: Used the correct AudioContext initialization per guideline
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      
      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setStatus('idle');
        setActiveSpeaker('none');
      };

      source.start();
      sourceRef.current = source;
      setStatus('playing');
      
      // Simple timer-based speaker simulation for visual effect
      // In a production app, we'd use metadata/timestamps if available
      simulateSpeakerTransitions();

    } catch (err) {
      console.error("Demo failed", err);
      setStatus('error');
    }
  };

  const simulateSpeakerTransitions = () => {
    // Mock timing for visual highlights based on the script
    setTimeout(() => setActiveSpeaker('founder'), 0);
    setTimeout(() => setActiveSpeaker('investor'), 6000);
    setTimeout(() => setActiveSpeaker('founder'), 12000);
    setTimeout(() => setActiveSpeaker('investor'), 18000);
    setTimeout(() => setActiveSpeaker('founder'), 24000);
    setTimeout(() => setActiveSpeaker('investor'), 28000);
  };

  useEffect(() => {
    return () => {
      if (sourceRef.current) sourceRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return (
    <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-12 text-center shadow-2xl animate-in zoom-in duration-300">
      <div className="mb-8">
        <h2 className="text-3xl font-bold heading-font mb-2">The "Monologue" Mistake</h2>
        <p className="text-zinc-500 text-sm">Listen to a typical high-stakes interaction.</p>
      </div>

      <div className="flex justify-center items-center gap-12 mb-12">
        <div className="flex flex-col items-center gap-4">
          <div className={`w-24 h-24 rounded-full border-4 transition-all duration-300 ${activeSpeaker === 'founder' ? 'border-indigo-500 scale-110 shadow-lg shadow-indigo-500/20' : 'border-zinc-800 opacity-40'}`}>
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Founder" className="rounded-full bg-zinc-800 p-2" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Founder</span>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className={`w-24 h-24 rounded-full border-4 transition-all duration-300 ${activeSpeaker === 'investor' ? 'border-red-500 scale-110 shadow-lg shadow-red-500/20' : 'border-zinc-800 opacity-40'}`}>
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Shark" alt="Investor" className="rounded-full bg-zinc-800 p-2" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Investor</span>
        </div>
      </div>

      <div className="bg-black/40 border border-zinc-800 rounded-2xl p-6 mb-8 min-h-[120px] flex items-center justify-center italic text-zinc-400 text-sm leading-relaxed">
        {status === 'idle' && "Click 'Play Sample' to hear the simulation."}
        {status === 'loading' && "Generating spicy conversation..."}
        {status === 'playing' && (
          activeSpeaker === 'founder' ? '"...and we realized cloud costs were just too high..."' : 
          activeSpeaker === 'investor' ? '"Stop. I don\'t care about the garage. What\'s your burn rate?"' : '...'
        )}
      </div>

      <div className="flex flex-col gap-4">
        {status !== 'playing' ? (
          <button 
            onClick={playDemo}
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
            Play Demo Call
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold animate-pulse py-4">
            <span className="w-2 h-2 bg-indigo-500 rounded-full" /> Playing Conversation...
          </div>
        )}
        
        <button 
          onClick={onBack}
          className="text-zinc-500 text-sm hover:text-white transition-colors"
        >
          Return to Hub
        </button>
      </div>
    </div>
  );
};

export default DemoPlayer;
