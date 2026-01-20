
import React, { useState } from 'react';
import { FeedbackReport, TranscriptionTurn, MetricScore } from '../types';
import { GoogleGenAI } from '@google/genai';
import Tooltip from './Tooltip';

interface FeedbackScreenProps {
  feedback: FeedbackReport | null;
  history: TranscriptionTurn[];
  onRestart: () => void;
}

const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ feedback, history, onRestart }) => {
  const [isGeneratingSpicyThread, setIsGeneratingSpicyThread] = useState(false);
  const [spicyThread, setSpicyThread] = useState<string | null>(null);

  const generateSpicyThread = async () => {
    setIsGeneratingSpicyThread(true);
    try {
      // Fix: Follow initialization guideline to use process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Turn the following mock investor call results into a viral, "spicy", brutally honest LinkedIn/X thread. 
      Focus on the founder's mistakes (the "monologues") and the hard lessons learned. 
      Use short sentences, emojis, and a tone that is high-energy and provocative.
      
      Mistakes to highlight: ${feedback?.weaknesses.join(', ')}
      Advice received: ${feedback?.advice}
      
      Structure it as a multi-part thread.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      if (response.text) {
        setSpicyThread(response.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingSpicyThread(false);
    }
  };

  if (!feedback) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xl text-zinc-400 font-medium animate-pulse">Analyzing your pitch performance...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl w-full space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black heading-font text-white">Call Debrief</h2>
          <p className="text-zinc-400">Here's how you performed against the investor.</p>
        </div>
        <div className="flex gap-4">
          <Tooltip content="Overall weighted score of your pitch effectiveness.">
            <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl cursor-help group hover:border-indigo-500 transition-colors">
              <span className="text-zinc-500 font-medium uppercase text-xs tracking-widest group-hover:text-indigo-400">Score</span>
              <span className="text-5xl font-black text-indigo-500">{feedback.overallScore}</span>
            </div>
          </Tooltip>
          
          <Tooltip content="Measures how well you listened and adjusted to interruptions.">
            <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl cursor-help group hover:border-emerald-500 transition-colors">
              <span className="text-zinc-500 font-medium uppercase text-xs tracking-widest group-hover:text-emerald-400">Coachability</span>
              <span className="text-5xl font-black text-emerald-500">{feedback.coachabilityScore}</span>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Metrics Breakdown Grid */}
      <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl backdrop-blur-sm">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] mb-8">Performance Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {/* Fix: Cast Object.entries to fix the 'unknown' property access error */}
          {(Object.entries(feedback.metrics) as [string, MetricScore][]).map(([key, metric]) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-end">
                <Tooltip content={metric.description} position="right">
                  <span className="text-sm font-bold text-white border-b border-dotted border-zinc-600 cursor-help">{metric.label}</span>
                </Tooltip>
                <span className={`text-sm font-black ${metric.score > 70 ? 'text-indigo-400' : 'text-rose-400'}`}>{metric.score}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${metric.score > 70 ? 'bg-indigo-500' : 'bg-rose-500'}`} 
                  style={{ width: `${metric.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-zinc-900/40 border border-green-500/20 rounded-3xl backdrop-blur-sm">
          <h3 className="text-green-500 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
            Execution Wins
          </h3>
          <ul className="space-y-3">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-zinc-300 text-sm pl-4 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-green-500 before:rounded-full">{s}</li>
            ))}
          </ul>
        </div>

        <div className="p-8 bg-zinc-900/40 border border-red-500/20 rounded-3xl backdrop-blur-sm">
          <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            Monologue Warning
          </h3>
          <ul className="space-y-3">
            {feedback.weaknesses.map((w, i) => (
              <li key={i} className="text-zinc-300 text-sm pl-4 relative before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-red-500 before:rounded-full">{w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl">
        <h3 className="text-indigo-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          The "Shark" Questions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedback.keyQuestionsAsked.map((q, i) => (
            <div key={i} className="bg-black/40 border border-zinc-800/50 p-4 rounded-xl text-zinc-300 text-sm italic">
              "{q}"
            </div>
          ))}
        </div>
      </div>

      <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl">
        <h3 className="text-white font-bold mb-2 text-sm uppercase tracking-widest">Boardroom Advice</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">{feedback.advice}</p>
      </div>

      {spicyThread && (
        <div className="p-8 bg-indigo-950/20 border border-indigo-500/30 rounded-3xl animate-in slide-in-from-bottom-2">
          <h3 className="text-indigo-400 font-bold mb-4 flex items-center gap-2">
            <span role="img" aria-label="spicy">🌶️</span> Viral Thread Version
          </h3>
          <div className="whitespace-pre-wrap text-zinc-300 text-sm font-mono leading-relaxed bg-black/40 p-6 rounded-xl border border-zinc-800">
            {spicyThread}
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(spicyThread || '');
              alert('Copied to clipboard!');
            }}
            className="mt-4 text-xs text-indigo-400 hover:underline"
          >
            Copy to Clipboard
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-center gap-4">
        {!spicyThread && (
          <Tooltip content="Converts your transcript into a viral, lessons-learned post perfect for LinkedIn or X.">
            <button 
              onClick={generateSpicyThread}
              disabled={isGeneratingSpicyThread}
              className="px-8 py-4 bg-indigo-600/10 text-indigo-400 border border-indigo-600/50 font-bold rounded-full hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
            >
              {isGeneratingSpicyThread ? 'Cooking... 🌶️' : 'Generate Spicy Thread 🌶️'}
            </button>
          </Tooltip>
        )}
        <button 
          onClick={onRestart}
          className="px-10 py-4 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
        >
          New Practice Session
        </button>
      </div>
    </div>
  );
};

export default FeedbackScreen;
