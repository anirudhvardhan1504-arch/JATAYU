import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  Shield,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface SitrepExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sitrepMarkdown: string;
  locationName: string;
}

export const SitrepExportModal: React.FC<SitrepExportModalProps> = ({
  isOpen,
  onClose,
  sitrepMarkdown,
  locationName,
}) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownloadMd = () => {
    const blob = new Blob([sitrepMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedName = locationName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `JATAYU_SITREP_${sanitizedName}_${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sitrepMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header (hidden in print) */}
        <div className="px-6 py-4 bg-navy-900 text-white flex items-center justify-between border-b border-navy-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {t('sitrep.modalTitle')}
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                JATAYU Tactical Situational Telemetry & Operational Evidence Pack
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-navy-800 cursor-pointer"
            title={t('sitrep.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar (hidden in print) */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-slate-600 font-sans flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>{t('sitrep.disclaimer')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? t('sitrep.copied') : t('sitrep.copy')}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('sitrep.printView')}</span>
            </button>

            <button
              onClick={handleDownloadMd}
              className="px-4 py-1.5 bg-navy-900 hover:bg-navy-800 text-amber-300 text-xs font-mono font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-500/40"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('sitrep.downloadMd')}</span>
            </button>
          </div>
        </div>

        {/* Report Content Body (Printable) */}
        <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-navy-950 bg-slate-50/50 space-y-4 print:p-0 print:bg-white print:overflow-visible">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800 select-text p-4 bg-white rounded-lg border border-slate-200 shadow-2xs print:border-none print:shadow-none print:p-0">
            {sitrepMarkdown}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span className="font-mono text-[11px]">
            Format: Markdown (.md) • Zero-dependency deterministic offline synthesis
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-medium cursor-pointer"
          >
            {t('sitrep.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
