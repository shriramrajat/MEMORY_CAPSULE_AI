import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  onBack?: () => void;
}

/**
 * Feature-specific error boundary that provides a more contextual error UI
 * for individual features within the application.
 */
const FeatureErrorBoundary: React.FC<FeatureErrorBoundaryProps> = ({
  children,
  featureName,
  onBack,
}) => {
  const fallback = (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            {featureName} Error
          </h2>
          <p className="text-sm text-muted-foreground">
            We encountered an issue loading this feature. Your data is safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {onBack && (
            <Button
              onClick={onBack}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          )}
          <Button
            onClick={() => window.location.reload()}
            variant="default"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
};

export default FeatureErrorBoundary;
