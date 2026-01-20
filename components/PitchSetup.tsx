
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS } from '../constants';
import { InvestorPersona, PersonaConfig, PitchContext, SectorType } from '../types';
import Tooltip from './Tooltip';

interface PitchSetupProps {
  onStart: (persona: PersonaConfig, context: PitchContext) => void;
  onBack: () => void;
}

const SECTORS: SectorType[] = ['Enterprise SaaS', 'Biotech', 'Fintech', 'Hardware/DeepTech', 'Consumer', 'AI/Infrastructure'];

const PitchSetup: React.FC<PitchSetupProps> = ({ onStart, onBack }) => {
  const [selectedPersonaId, setSelectedPersonaId] = useState<InvestorPersona>(InvestorPersona.SHARK);
  const [startupName, setStartupName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deckSummary, setDeckSummary] = useState('');
  const [selectedSector, setSelectedSector] = useState<SectorType>('Enterprise SaaS');
  const [pdfData, setPdfData] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    const persona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];
    onStart(persona, { startupName, targetAmount, deckSummary, industry: selectedSector, pdfData });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        setPdfData(base64Data);
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64Data } },
              { text: "Analyze this pitch deck and provide a concise, high-impact 3-sentence summary. Output only the summary text." },
            ],
          },
        });
        if (response.text) setDeckSummary(response.text.trim());
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl w-full bg-zinc-900/40 border border-zinc-800 p-8 md:p-12 rounded-3xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold heading-font text-white">War Room Configuration</h2>
          <p className="text-zinc-500 text-sm mt-1">Setup your context to trigger sector-specific grilling.</p>
        </div>
        <button 
          onClick={onBack}
          className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Back
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Context Drop</h3>
              <Tooltip content="Upload your PDF and we'll extract the core thesis automatically.">
                <span className="text-zinc-600 cursor-help text-xs">ⓘ</span>
              </Tooltip>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf"
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className={`w-full py-4 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center gap-2 ${
                isAnalyzing 
                ? 'border-indigo-500/50 bg-indigo-500/10' 
                : 'border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-indigo-400">Scanning Logic...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs font-medium text-zinc-400">Drop Pitch Deck (PDF)</span>
                </>
              )}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">Battleground Sector</label>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map(sector => (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    selectedSector === sector 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Startup Identity</label>
              <input 
                type="text" 
                value={startupName}
                onChange={e => setStartupName(e.target.value)}
                placeholder="e.g. Acme.ai - Keep it simple"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-colors text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Raise Target</label>
              <input 
                type="text" 
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                placeholder="e.g. $2.5M Seed (Don't waffle on this)"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-colors text-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <label className="block text-sm font-medium text-zinc-500 mb-2 uppercase tracking-widest text-white">Your Opponent</label>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[60vh] pr-2 scrollbar-hide">
            {PERSONAS.map(persona => (
              <div key={persona.id} className="relative group">
                <button
                  onClick={() => setSelectedPersonaId(persona.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden ${
                    selectedPersonaId === persona.id 
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                      : 'bg-zinc-800/20 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">{persona.name}</div>
                    {selectedPersonaId === persona.id && (
                      <div className="bg-indigo-500 h-2 w-2 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mb-3 leading-relaxed">{persona.description}</div>
                  <div className="flex flex-wrap gap-2">
                    {persona.traits.map(trait => (
                      <span key={trait} className="px-2 py-0.5 bg-zinc-800/50 border border-zinc-700/50 rounded-md text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                        {trait}
                      </span>
                    ))}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-end gap-4">
        <button 
          onClick={onBack}
          className="px-8 py-4 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-all"
        >
          Cancel
        </button>
        <button 
          onClick={handleStart}
          disabled={!startupName || !targetAmount || isAnalyzing}
          className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          {isAnalyzing ? 'Scanning Deck...' : 'Enter Call'}
        </button>
      </div>
    </div>
  );
};

export default PitchSetup;
