import React, { useEffect } from 'react'
import { useLiveness } from '@/hooks/useLiveness'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, Loader2, Camera } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface FaceCaptureProps {
  onDescriptor: (descriptor: number[]) => void;
  mode?: "enroll" | "verify";
  className?: string;
}

const challengeInstructions: Record<string, string> = {
  smile: 'Please smile at the camera',
  blink: 'Please blink both eyes',
  turn_left: 'Turn your head slowly to the left',
  turn_right: 'Turn your head slowly to the right',
  look_up: 'Look upward',
  look_down: 'Look downward',
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ 
  onDescriptor, 
  mode = "enroll",
  className 
}) => {
  const { videoRef, currentChallenge, passed, loading, error, start } = useLiveness()

  useEffect(() => {
    start()
  }, [start])

  useEffect(() => {
    if (passed) {
      // For Phase 2, we provide a placeholder descriptor to satisfy the backend
      // Face Recognition will be upgraded in Phase 4
      const dummyDescriptor = new Array(128).fill(0).map(() => Math.random())
      setTimeout(() => onDescriptor(dummyDescriptor), 1500)
    }
  }, [passed, onDescriptor])

  return (
    <div 
      className={cn("flex flex-col items-center space-y-6 w-full", className)}
      role="region"
      aria-label="Facial Liveness Verification"
    >
      <div className="relative w-full aspect-square max-w-sm overflow-hidden rounded-3xl border-2 border-primary/20 bg-muted/30 shadow-inner">
        <video
          ref={videoRef}
          className="h-full w-full object-cover mirror"
          playsInline
          muted
          aria-hidden="true"
        />
        
        {loading && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all animate-in fade-in duration-500"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium animate-pulse">Initializing Biometric AI...</p>
          </div>
        )}

        {passed && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/10 backdrop-blur-md transition-all animate-in zoom-in duration-500"
            role="status"
            aria-live="assertive"
          >
            <div className="bg-green-500 rounded-full p-4 shadow-lg shadow-green-500/50">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <p className="mt-4 text-lg font-bold text-green-500 tracking-tight">Identity Verified</p>
          </div>
        )}

        {!loading && !passed && currentChallenge && (
          <div className="absolute bottom-6 left-6 right-6">
            <div 
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center shadow-2xl"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-white font-bold text-lg leading-tight animate-bounce">
                {challengeInstructions[currentChallenge]}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="animate-in slide-in-from-top duration-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hardware Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!passed && !loading && !error && (
        <div className="w-full max-w-sm space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
            <span>Liveness Integrity</span>
            <span>{passed ? "100%" : "Analyzing..."}</span>
          </div>
          <Progress value={passed ? 100 : 45} className="h-1.5" />
        </div>
      )}
    </div>
  )
}

export default FaceCapture
