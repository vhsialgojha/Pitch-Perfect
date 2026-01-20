
export enum InvestorPersona {
  SHARK = 'Shark',
  VISIONARY = 'Visionary',
  SKEPTIC = 'Skeptic',
  SUPPORTIVE = 'Supportive',
  BRUTAL = 'Brutal',
  GLOBAL = 'Global',
  BIOTECH = 'Biotech Specialist',
  SAAS_HAWK = 'SaaS Hawk'
}

export type SectorType = 'Enterprise SaaS' | 'Biotech' | 'Fintech' | 'Hardware/DeepTech' | 'Consumer' | 'AI/Infrastructure';

export interface PersonaConfig {
  id: InvestorPersona;
  name: string;
  description: string;
  instruction: string;
  traits: string[];
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  profileUrl: string;
  languages?: string[]; // Supported languages for the session
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface PitchContext {
  deckSummary: string;
  startupName: string;
  targetAmount: string;
  industry: SectorType;
  pdfData?: string; // Base64 encoded PDF
}

export interface TranscriptionTurn {
  role: 'user' | 'model';
  text: string;
}

export interface MetricScore {
  score: number;
  label: string;
  description: string;
}

export interface FeedbackReport {
  overallScore: number;
  coachabilityScore: number;
  metrics: {
    conciseness: MetricScore;
    dataReadiness: MetricScore;
    confidence: MetricScore;
    agility: MetricScore;
  };
  strengths: string[];
  weaknesses: string[];
  keyQuestionsAsked: string[];
  advice: string;
}
