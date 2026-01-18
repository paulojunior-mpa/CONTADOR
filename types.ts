
import React from 'react';

export type Specialty = 
  | 'CONTABILIDADE' 
  | 'ADVOCACIA' 
  | 'RH' 
  | 'TRABALHISTA' 
  | 'CIVIL' 
  | 'CONSTITUCIONAL' 
  | 'REFORMA_TRIBUTARIA'
  | 'AUDITOR_FISCAL'
  | 'GERAL';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
  status?: 'sending' | 'sent';
  sources?: { uri: string, title: string }[];
}

export interface SpecialtyCardProps {
  id: Specialty;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export interface LegislativeAlert {
  id: string;
  area: Specialty;
  title: string;
  description: string;
  date: string;
  isNew: boolean;
}

export type NotificationSettings = Record<Specialty, boolean>;
