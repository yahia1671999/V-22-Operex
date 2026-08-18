import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { ApiErrorInfo } from '../api';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: ApiErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    try {
      const parsed = JSON.parse(error.message) as ApiErrorInfo;
      if (parsed.error && parsed.authInfo) {
        return { hasError: true, errorInfo: parsed };
      }
    } catch {
      // Not a Firestore JSON error
    }
    return { hasError: true, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    const { hasError, errorInfo } = this.state;
    const { children } = this.props;

    if (hasError) {
      const isQuotaExceeded = errorInfo?.error?.includes('Quota exceeded') || 
                            errorInfo?.error?.includes('Quota limit exceeded');

      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <div className="bg-card text-foreground rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full text-center space-y-6 border border-border">
            <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">
                {isQuotaExceeded ? 'تجاوز حصة الاستخدام' : 'حدث خطأ ما'}
              </h2>
              <p className="text-muted-foreground font-medium leading-relaxed">
                {isQuotaExceeded 
                  ? 'لقد تجاوزت حصة الاستخدام اليومية. ستتم إعادة تعيين الحصة تلقائياً غداً.' 
                  : 'عذراً، حدث خطأ غير متوقع أثناء معالجة البيانات.'}
              </p>
            </div>

            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all flex items-center justify-center gap-2 hover:bg-primary/90 shadow-lg"
            >
              <RefreshCcw className="w-5 h-5" />
              تحديث الصفحة
            </button>
            
            {!isQuotaExceeded && errorInfo && (
              <div className="mt-4 p-4 bg-muted rounded-2xl text-left overflow-auto max-h-40 border border-border">
                <code className="text-xs text-muted-foreground">
                  {JSON.stringify(errorInfo, null, 2)}
                </code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
