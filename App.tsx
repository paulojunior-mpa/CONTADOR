
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Home, 
  MessageSquare, 
  FileText, 
  Scale, 
  Briefcase, 
  BookOpen, 
  Calculator, 
  Settings,
  ChevronRight,
  Send,
  Camera,
  Search,
  ArrowLeft,
  Loader2,
  Bell,
  CheckCircle2,
  X,
  Upload,
  AlertCircle,
  Check,
  CheckCheck,
  Mic,
  MicOff,
  History,
  Trash2,
  WifiOff,
  CloudOff,
  Info,
  Sun,
  Moon,
  Share2,
  Sparkles,
  FileCode,
  FileSpreadsheet,
  FileJson,
  FileArchive,
  AlignLeft,
  Paperclip,
  ExternalLink,
  Zap,
  Gavel,
  Tag,
  Bookmark,
  BookmarkCheck,
  ShieldCheck,
  Clock,
  Download,
  Command
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Specialty, ChatMessage, LegislativeAlert, NotificationSettings } from './types';
import { gemini } from './services/geminiService';

// --- Global Speech Recognition Support ---
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;

// --- Utility Functions ---
const handleShare = async (title: string, text: string) => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text,
        url: window.location.href,
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      alert('Conteúdo copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  }
};

// --- Mock Data for Alerts ---
const MOCK_ALERTS: LegislativeAlert[] = [
  {
    id: '0', area: 'REFORMA_TRIBUTARIA', title: 'Novas Leis Complementares da Reforma', description: 'Regulamentação do IBS e CBS avança no Senado com novos prazos.', date: 'Agora', isNew: true
  },
  {
    id: '5', area: 'AUDITOR_FISCAL', title: 'Fiscalização SEFA 2024', description: 'Novas diretrizes para auditoria de ICMS em operações interestaduais.', date: 'Hoje', isNew: true
  },
  {
    id: '1', area: 'TRABALHISTA', title: 'Nova Portaria sobre FGTS Digital', description: 'Alterações nos prazos de recolhimento via PIX começam a valer este mês.', date: 'Ontem', isNew: true
  },
  {
    id: '2', area: 'CONTABILIDADE', title: 'Reforma Tributária: Alíquotas de Referência', description: 'Divulgada nota técnica sobre a transição para o IBS e CBS.', date: 'Ontem', isNew: true
  }
];

// --- Helper Components ---

const OfflineBanner = () => (
  <div className="bg-amber-500 text-white px-4 py-1.5 flex items-center justify-center space-x-2 text-[10px] font-bold uppercase tracking-widest animate-fadeIn">
    <WifiOff size={14} />
    <span>Modo Offline - Acesso limitado ao histórico</span>
  </div>
);

const NavButton = ({ active, icon: Icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center space-y-1 w-full transition-colors ${
      active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
    }`}
  >
    <Icon size={24} />
    <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
  </button>
);

const FeatureCard = ({ title, icon: Icon, color, onClick, description }: any) => (
  <button 
    onClick={onClick}
    className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-start text-left space-x-4 active:scale-95 transition-transform"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="text-white" size={24} />
    </div>
    <div className="flex-1">
      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{title}</h3>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-relaxed">{description}</p>
    </div>
    <ChevronRight className="text-gray-300 dark:text-slate-700 self-center" size={20} />
  </button>
);

const Toggle = ({ active, onToggle }: { active: boolean, onToggle: () => void }) => (
  <button 
    onClick={onToggle}
    className={`w-12 h-6 rounded-full transition-colors relative ${active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
  >
    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-7' : 'left-1'}`} />
  </button>
);

// --- Specialized Document Analysis View ---

const DocumentAnalysisView = ({ onBack, hideHeader = false, isOnline }: { onBack: () => void, hideHeader?: boolean, isOnline: boolean }) => {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [fileData, setFileData] = useState<{ base64: string, mimeType: string, fileName: string } | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [docType, setDocType] = useState<string>('Geral');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFileData({
          base64: base64,
          mimeType: f.type || 'application/octet-stream',
          fileName: f.name
        });
      };
      reader.readAsDataURL(f);
    }
  };

  const handleStartAnalysis = async () => {
    if (!isOnline) return;
    setAnalyzing(true);
    setResult(null);
    try {
      let analysis: string;
      if (mode === 'upload' && fileData) {
        analysis = await gemini.analyzeDocument(fileData.base64, fileData.mimeType, docType, false);
      } else if (mode === 'paste' && pastedText.trim()) {
        analysis = await gemini.analyzeDocument(pastedText, 'text/plain', docType, true);
      } else {
        setAnalyzing(false);
        return;
      }
      setResult(analysis);
      setFileData(null);
      setPastedText('');
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportPDF = () => {
    if (!result) return;
    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const textWidth = pageWidth - (margin * 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175);
      doc.text('Relatório PPSILVA Solutions', margin, 30);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Análise: ${docType} | Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, 38);

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 45, pageWidth - margin, 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);

      const splitText = doc.splitTextToSize(result, textWidth);
      doc.text(splitText, margin, 55);

      doc.save(`PPSILVA_Analise_${docType.replace(/\s/g, '_')}_${Date.now()}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('image')) return <Camera size={48} className="text-blue-500" />;
    if (mime.includes('pdf')) return <FileText size={48} className="text-red-500" />;
    return <FileArchive size={48} className="text-blue-600" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 animate-fadeIn transition-colors duration-300">
      {!hideHeader && (
        <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 -ml-2 text-slate-700 dark:text-slate-300 flex items-center space-x-1 hover:text-blue-600 transition-colors">
              <ArrowLeft size={24} />
              <span className="text-sm font-bold">Voltar</span>
            </button>
            <div className="flex items-center space-x-2 relative">
              <FileText size={20} className="text-blue-600 dark:text-blue-400" />
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Análise Inteligente</h2>
              <button 
                onClick={() => setShowTooltip(!showTooltip)}
                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
              >
                <Info size={16} />
              </button>
            </div>
          </div>
          {result && (
            <div className="flex items-center space-x-1">
              <button 
                onClick={handleExportPDF} 
                disabled={exporting}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Exportar PDF"
              >
                {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              </button>
              <button onClick={() => handleShare('Análise PPSILVA', result)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors">
                <Share2 size={20} />
              </button>
            </div>
          )}
        </header>
      )}

      {!isOnline && <OfflineBanner />}

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isOnline && !result && !analyzing ? (
          <>
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
              <button onClick={() => setMode('upload')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 ${mode === 'upload' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>
                <Paperclip size={16} />
                <span>Arquivo</span>
              </button>
              <button onClick={() => setMode('paste')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 ${mode === 'paste' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}>
                <AlignLeft size={16} />
                <span>Texto</span>
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo de Conteúdo:</label>
              <div className="grid grid-cols-2 gap-3">
                {['Contrato', 'Holerite', 'Balanço/DRE', 'Fiscal (SEFA)', 'Geral'].map((type) => (
                  <button key={type} onClick={() => setDocType(type)} className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${docType === type ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'upload' ? (
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 bg-white dark:bg-slate-900 hover:bg-slate-50 cursor-pointer">
                {fileData ? (
                  <div className="space-y-4 w-full flex flex-col items-center">
                    {fileData.mimeType.includes('image') ? <img src={`data:${fileData.mimeType};base64,${fileData.base64}`} className="max-h-64 object-contain rounded-xl shadow-sm" /> : <div className="p-8 bg-blue-50 dark:bg-blue-900/20 rounded-full">{getFileIcon(fileData.mimeType)}</div>}
                    <p className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{fileData.fileName}</p>
                  </div>
                ) : (
                  <>
                    <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600"><Upload size={40} /></div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">Escolher Arquivo</p>
                  </>
                )}
                <input type="file" hidden ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,.doc,.docx,image/*" />
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm flex flex-col space-y-3">
                <textarea 
                  value={pastedText} 
                  onChange={(e) => setPastedText(e.target.value)} 
                  placeholder="Cole aqui o texto..." 
                  className="w-full h-64 bg-transparent border-none focus:ring-0 text-sm resize-none text-black" 
                />
              </div>
            )}

            <button onClick={handleStartAnalysis} disabled={(!fileData && !pastedText.trim()) || !isOnline} className="w-full bg-blue-700 dark:bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg">
              <Sparkles size={20} />
              <span>Analisar Agora</span>
            </button>
          </>
        ) : analyzing ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <h3 className="font-bold text-xl">Auditando Documento...</h3>
          </div>
        ) : result ? (
          <div className="space-y-6 animate-slideUp">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="prose prose-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{result}</div>
            </div>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={handleExportPDF}
                className="w-full bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-md hover:bg-blue-800 transition-colors"
              >
                <Download size={20} />
                <span>Exportar Relatório em PDF</span>
              </button>
              <button onClick={() => { setResult(null); setFileData(null); }} className="w-full bg-slate-200 dark:bg-slate-800 py-4 rounded-2xl font-bold">Nova Análise</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// --- Chat View ---

const ChatView = ({ initialSpecialty, onBack, isOnline }: { initialSpecialty: Specialty, onBack?: () => void, isOnline: boolean }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`lexconsul_chat_${initialSpecialty}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSendingEffect, setIsSendingEffect] = useState(false);
  const [isSavedEffect, setIsSavedEffect] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(`lexconsul_chat_${initialSpecialty}`, JSON.stringify(messages));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'pt-BR';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => setInput(prev => (prev + " " + event.results[0][0].transcript).trim());
      recognitionRef.current = recognition;
    }
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || !isOnline) return;
    setIsSendingEffect(true);
    setTimeout(() => setIsSendingEffect(false), 300);
    const currentInput = input;
    const currentImage = selectedImage;
    setMessages(prev => [...prev, { role: 'user', content: currentInput, image: currentImage || undefined, status: 'sending' }]);
    setInput('');
    setSelectedImage(null);
    setLoading(true);
    const history = messages.map(m => ({ role: m.role, parts: m.image ? [{ text: m.content }, { inlineData: { mimeType: 'image/jpeg', data: m.image.split(',')[1] } }] : [{ text: m.content }] }));
    try {
      const { text, sources } = await gemini.chat(`Contexto: ${initialSpecialty}. Pergunta: ${currentInput}`, history as any, currentImage?.split(',')[1]);
      setMessages(prev => [...prev.map(m => m.status === 'sending' ? { ...m, status: 'sent' as any } : m), { role: 'model', content: text, sources }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', content: "Erro na comunicação." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConsultation = () => {
    if (messages.length < 2) return;
    const lastModel = messages[messages.length - 1];
    const lastUser = messages[messages.length - 2];
    if (lastModel.role !== 'model' || lastUser.role !== 'user') return;
    const saved = JSON.parse(localStorage.getItem('lexconsul_saved_consultations') || '[]');
    const newSave = { id: Date.now(), specialty: initialSpecialty, date: new Date().toLocaleDateString('pt-BR'), query: lastUser.content, response: lastModel.content };
    saved.unshift(newSave);
    localStorage.setItem('lexconsul_saved_consultations', JSON.stringify(saved.slice(0, 50)));
    setIsSavedEffect(true);
    setTimeout(() => setIsSavedEffect(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 text-slate-700 dark:text-slate-300 flex items-center space-x-1 hover:text-blue-600 transition-colors">
              <ArrowLeft size={24} />
              <span className="text-sm font-bold">Voltar</span>
            </button>
          )}
          <div>
            <h2 className="font-bold text-sm">{initialSpecialty.replace('_', ' ')}</h2>
            <p className="text-[10px] text-blue-600 font-bold">PPSILVA CONSULTING</p>
          </div>
        </div>
        <button onClick={() => setMessages([])} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-messageEntry`}>
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${m.role === 'user' ? 'bg-blue-700 text-white rounded-tr-none shadow-md' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-800 shadow-sm'}`}>
              {m.image && <img src={m.image} className="rounded-lg mb-2 max-h-48 w-full object-cover" />}
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.sources && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 mb-1">FONTES:</p>
                  {m.sources.map((s, idx) => <a key={idx} href={s.uri} target="_blank" className="text-[10px] text-blue-500 block truncate">{s.title}</a>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl w-20 animate-pulse">...</div>}
        <div className="h-20" />
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 space-y-3 pb-24">
        <div className="flex items-end space-x-2">
          <label className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full cursor-pointer text-slate-500">
            <Camera size={20} /><input type="file" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const r = new FileReader();
                r.onloadend = () => setSelectedImage(r.result as string);
                r.readAsDataURL(f);
              }
            }} />
          </label>
          <div className="flex-1 bg-white rounded-2xl px-4 py-2 flex items-center border border-slate-100">
            <textarea 
              rows={1} 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Sua dúvida para PPSILVA..." 
              className="w-full bg-transparent border-none focus:ring-0 text-sm py-1 text-black" 
            />
          </div>
          <div className="flex space-x-1">
            <button 
              onClick={handleSaveConsultation} 
              className={`p-3 rounded-full shadow-md transition-all ${isSavedEffect ? 'bg-green-600 text-white animate-saveSuccess' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 active:scale-90'}`}
            >
              {isSavedEffect ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
            </button>
            <button onClick={handleSend} className="p-3 bg-blue-700 text-white rounded-full shadow-lg active:scale-95"><Send size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Home View ---

const HomeView = ({ onSelectSpecialty, onOpenAlerts, unreadCount, isOnline, toggleTheme, isDark }: { onSelectSpecialty: (s: Specialty) => void, onOpenAlerts: () => void, unreadCount: number, isOnline: boolean, toggleTheme: () => void, isDark: boolean }) => {
  const [savedConsults, setSavedConsults] = useState<any[]>([]);
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('lexconsul_saved_consultations') || '[]');
    setSavedConsults(saved.slice(0, 3));
  }, []);

  return (
    <div className="p-6 space-y-6 animate-fadeIn h-full overflow-y-auto pb-24 transition-colors duration-300">
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl logo-gradient flex items-center justify-center text-white shadow-lg overflow-hidden">
             <Command size={28} />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold tracking-tight text-slate-900 dark:text-slate-100">PPSILVA</h1>
            <p className="text-[10px] font-bold text-blue-600 tracking-[0.2em] uppercase">Solutions</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={toggleTheme} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
            {isDark ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} />}
          </button>
          <button onClick={onOpenAlerts} className="relative p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
            <Bell size={24} />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">{unreadCount}</span>}
          </button>
        </div>
      </header>

      {!isOnline && <OfflineBanner />}

      <div className="bg-gradient-to-br from-orange-600 to-red-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all" onClick={() => onSelectSpecialty('REFORMA_TRIBUTARIA')}>
        <div className="absolute top-0 right-0 p-4 opacity-15"><Zap size={80} /></div>
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles size={16} className="animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">Destaque 2024</span>
        </div>
        <h2 className="text-xl font-bold mb-1">Nova Reforma Tributária</h2>
        <p className="text-orange-100 text-xs mb-4 leading-relaxed">Tudo sobre IBS, CBS e impactos pela PPSILVA.</p>
        <div className="flex items-center text-xs font-bold space-x-1"><span>Consultar Especialista</span><ChevronRight size={14} /></div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <FeatureCard 
          title="Consultoria Fiscal & SEFA" 
          description="Auditoria de ICMS, malha fina fiscal e conformidade tributária estadual." 
          icon={ShieldCheck} 
          color="bg-blue-700 dark:bg-blue-800" 
          onClick={() => onSelectSpecialty('AUDITOR_FISCAL')} 
        />
        <FeatureCard 
          title="Advocacia Especializada" 
          description="Constitucional, Civil e todas as leis brasileiras." 
          icon={Scale} 
          color="bg-slate-700 dark:bg-slate-800" 
          onClick={() => onSelectSpecialty('ADVOCACIA')} 
        />
        <FeatureCard 
          title="Contabilidade & Tributos" 
          description="Balanços, NBC e sistemas tributários atuais." 
          icon={Calculator} 
          color="bg-emerald-600" 
          onClick={() => onSelectSpecialty('CONTABILIDADE')} 
        />
        <FeatureCard 
          title="Trabalhista & RH" 
          description="Gestão de folha, CLT e relações laborais." 
          icon={Briefcase} 
          color="bg-indigo-600" 
          onClick={() => onSelectSpecialty('TRABALHISTA')} 
        />
      </div>

      {savedConsults.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center space-x-2">
              <Clock size={18} className="text-blue-500" />
              <span className="text-sm">Consultas Salvas (PPSILVA)</span>
            </h3>
          </div>
          <div className="space-y-3">
            {savedConsults.map((c: any) => (
              <div key={c.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm animate-fadeIn">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">{c.specialty}</span>
                  <span className="text-[10px] text-slate-400">{c.date}</span>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{c.query}</p>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed opacity-80">{c.response}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LegislativeSearchView = ({ onBack, onSelectQuery }: { onBack: () => void, onSelectQuery: (q: string) => void }) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('lexconsul_search_history');
    return saved ? JSON.parse(saved) : ['Emenda 132 Reforma Tributária', 'Fiscalização ICMS SEFA', 'Simples Nacional 2024'];
  });
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    const cleanTerm = searchTerm.replace(/^\[.*?\]\s*/, '').trim();
    setHistory(prev => [cleanTerm, ...prev.filter(h => h !== cleanTerm)].slice(0, 8));
    onSelectQuery(cleanTerm);
    setQuery('');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors animate-fadeIn">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-700 dark:text-slate-300 flex items-center space-x-1 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
            <span className="text-sm font-bold">Voltar</span>
          </button>
          <h2 className="font-bold">Explorar Legislação</h2>
        </div>
      </header>
      <div className="p-6 flex-1 flex flex-col space-y-6">
        <div className="relative">
          <div className={`relative w-full flex items-center bg-white dark:bg-slate-900 border rounded-2xl shadow-sm transition-all ${isFocused ? 'ring-2 ring-blue-500 border-transparent' : 'border-slate-200'}`}>
            <Search className="ml-4 text-slate-400" size={20} />
            <input 
              type="text" 
              value={query} 
              onFocus={() => setIsFocused(true)} 
              onBlur={() => setTimeout(() => setIsFocused(false), 200)} 
              onChange={(e) => setQuery(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)} 
              placeholder="Pesquisa PPSILVA..." 
              className="w-full pl-3 pr-4 py-4 bg-transparent outline-none text-black" 
            />
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">Buscas Recentes</h3>
          <div className="flex flex-wrap gap-2">
            {history.map((item, idx) => (
              <button key={idx} onClick={() => handleSearch(item)} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700 active:scale-95 transition-transform">{item}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertsView = ({ onBack, alerts, settings, onOpenSettings }: { onBack: () => void, alerts: LegislativeAlert[], settings: NotificationSettings, onOpenSettings: () => void }) => {
  const filteredAlerts = alerts.filter(a => settings[a.area]);
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors animate-fadeIn">
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-700 dark:text-slate-300 flex items-center space-x-1 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
            <span className="text-sm font-bold">Voltar</span>
          </button>
          <h2 className="font-bold">Alertas LexConsul</h2>
        </div>
        <button onClick={onOpenSettings} className="p-2 text-slate-500"><Settings size={20} /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {filteredAlerts.length > 0 ? filteredAlerts.map(alert => (
          <div key={alert.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{alert.area}</span>
              <span className="text-[10px] text-slate-400">{alert.date}</span>
            </div>
            <h3 className="font-bold text-sm">{alert.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{alert.description}</p>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
             <Bell size={48} className="opacity-20" />
             <p className="text-sm">Nenhum alerta novo para suas preferências.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsModal = ({ settings, onToggle, onClose, isDark, toggleTheme }: { settings: NotificationSettings, onToggle: (s: Specialty) => void, onClose: () => void, isDark: boolean, toggleTheme: () => void }) => {
  const specialties: Specialty[] = ['CONTABILIDADE', 'ADVOCACIA', 'RH', 'TRABALHISTA', 'CIVIL', 'CONSTITUCIONAL', 'REFORMA_TRIBUTARIA', 'AUDITOR_FISCAL', 'GERAL'];
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 animate-fadeIn" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-6 space-y-6 animate-slideUp shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">Configurações PPSILVA</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X size={20} /></button>
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
          <div className="flex items-center space-x-3">{isDark ? <Moon size={20} /> : <Sun size={20} />}<span>Modo Escuro</span></div>
          <Toggle active={isDark} onToggle={toggleTheme} />
        </div>
        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
          {specialties.map(s => (
            <div key={s} className="flex items-center justify-between py-2 border-b last:border-0 border-slate-50 dark:border-slate-800">
              <span className="text-sm font-medium capitalize">{s.toLowerCase().replace('_', ' ')}</span>
              <Toggle active={settings[s]} onToggle={() => onToggle(s)} />
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full bg-blue-700 text-white py-4 rounded-2xl font-bold">Salvar Preferências</button>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'docs' | 'search' | 'alerts'>('home');
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('lexconsul_theme') === 'dark');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('lexconsul_notif_prefs');
    return saved ? JSON.parse(saved) : { CONTABILIDADE: true, ADVOCACIA: true, RH: true, TRABALHISTA: true, CIVIL: true, CONSTITUCIONAL: true, REFORMA_TRIBUTARIA: true, AUDITOR_FISCAL: true, GERAL: true };
  });

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('lexconsul_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleTogglePreference = (s: Specialty) => setNotificationSettings(prev => ({ ...prev, [s]: !prev[s] }));
  const unreadAlertsCount = useMemo(() => MOCK_ALERTS.filter(a => a.isNew && notificationSettings[a.area]).length, [notificationSettings]);

  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto relative overflow-hidden shadow-2xl transition-colors duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <main className="flex-1 relative overflow-hidden">
        <div className={`absolute inset-0 ${activeTab === 'home' ? 'z-10' : 'z-0 invisible'}`}>
          <HomeView onSelectSpecialty={setSelectedSpecialty} onOpenAlerts={() => setActiveTab('alerts')} unreadCount={unreadAlertsCount} isOnline={isOnline} toggleTheme={() => setIsDarkMode(!isDarkMode)} isDark={isDarkMode} />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'search' ? 'z-10' : 'z-0 invisible'}`}>
          <LegislativeSearchView onBack={() => setActiveTab('home')} onSelectQuery={() => setSelectedSpecialty('GERAL')} />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'chat' ? 'z-10' : 'z-0 invisible'}`}>
          <ChatView initialSpecialty="GERAL" onBack={() => setActiveTab('home')} isOnline={isOnline} />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'alerts' ? 'z-10' : 'z-0 invisible'}`}>
          <AlertsView onBack={() => setActiveTab('home')} alerts={MOCK_ALERTS} settings={notificationSettings} onOpenSettings={() => setShowSettings(true)} />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'docs' ? 'z-10' : 'z-0 invisible'}`}>
          <DocumentAnalysisView onBack={() => setActiveTab('home')} isOnline={isOnline} />
        </div>
        {selectedSpecialty && (
          <div className="absolute inset-0 z-[100] bg-white dark:bg-slate-950 animate-slideUp">
            <ChatView initialSpecialty={selectedSpecialty} onBack={() => setSelectedSpecialty(null)} isOnline={isOnline} />
          </div>
        )}
      </main>

      {!selectedSpecialty && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t dark:border-slate-800 px-6 pt-3 pb-safe flex justify-between items-center shadow-lg z-[90]">
          <NavButton active={activeTab === 'home'} icon={Home} label="Início" onClick={() => setActiveTab('home')} />
          <NavButton active={activeTab === 'search'} icon={Search} label="Busca" onClick={() => setActiveTab('search')} />
          <NavButton active={activeTab === 'chat'} icon={MessageSquare} label="Chat" onClick={() => setActiveTab('chat')} />
          <NavButton active={activeTab === 'alerts'} icon={Bell} label="Alertas" onClick={() => setActiveTab('alerts')} />
          <NavButton active={activeTab === 'docs'} icon={FileText} label="Análise" onClick={() => setActiveTab('docs')} />
        </nav>
      )}

      {showSettings && <SettingsModal settings={notificationSettings} onToggle={handleTogglePreference} onClose={() => setShowSettings(false)} isDark={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes messageEntry { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes saveSuccess {
          0% { transform: scale(1); }
          25% { transform: scale(1.3) rotate(-5deg); }
          50% { transform: scale(0.9) rotate(5deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-messageEntry { animation: messageEntry 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-saveSuccess { animation: saveSuccess 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .invisible { pointer-events: none; opacity: 0; }
        html, body { height: 100%; overflow: hidden; }
      `}</style>
    </div>
  );
}
