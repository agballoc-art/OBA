import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Une erreur inattendue est survenue.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('OBA IMPÉRIAL ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0908] text-[#FAF7F0] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#16110E] border border-[#A97142]/40 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#3B1F11] text-[#D4AF37] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl font-bold text-[#FAF7F0]">
              Interruption momentanée
            </h2>
            <p className="text-sm text-[#EFE8DA]/80 leading-relaxed">
              Une erreur technique s&apos;est produite lors de la communication avec le service.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D4AF37] text-[#0B0908] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E5C158] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Actualiser la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
