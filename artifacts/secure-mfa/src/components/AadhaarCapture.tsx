import { useState, useRef, useCallback, useEffect } from "react";
import { createWorker } from "tesseract.js";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Camera, Upload, RefreshCcw, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface AadhaarCaptureProps {
  onCapture: (number: string, image: string) => void;
  className?: string;
}

export function AadhaarCapture({ onCapture, className }: AadhaarCaptureProps) {
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ number: string; confidence: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: 1280, height: 720 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
        setError(null);
      }
    } catch (err) {
      setError("Camera access denied. Please use the upload option.");
      setMode("upload");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  const runOCR = async (imageSrc: string) => {
    setIsProcessing(true);
    setOcrResult(null);
    setError(null);
    
    try {
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(imageSrc);
      await worker.terminate();

      // Look for 12 digit pattern (Aadhaar format: XXXX XXXX XXXX or XXXXXXXXXXXX)
      const matches = text.replace(/\s/g, "").match(/[0-9]{12}/);
      
      if (matches) {
        const foundNumber = matches[0];
        setOcrResult({ number: foundNumber, confidence: 100 });
        toast.success("Aadhaar number detected successfully");
        onCapture(foundNumber, imageSrc);
      } else {
        setError("Could not clearly read Aadhaar number. Please ensure the card is well-lit and centered.");
        toast.warning("Manual entry might be required");
      }
    } catch (err) {
      setError("OCR processing failed.");
      toast.error("Error reading image");
    } finally {
      setIsProcessing(false);
    }
  };

  const capture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageSrc = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(imageSrc);
        stopCamera();
        runOCR(imageSrc);
      }
    }
  }, [stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCapturedImage(result);
        runOCR(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setError(null);
    if (mode === "camera") startCamera();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex bg-muted p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setMode("camera")}
          className={`flex-1 flex items-center justify-center py-2 rounded-md transition-all text-sm font-medium ${
            mode === "camera" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <Camera className="w-4 h-4 mr-2" />
          Capture
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex-1 flex items-center justify-center py-2 rounded-md transition-all text-sm font-medium ${
            mode === "upload" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </button>
      </div>

      <div className="relative aspect-[1.6/1] w-full bg-black rounded-xl overflow-hidden border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!capturedImage && mode === "camera" && (
            <motion.div 
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-primary/50 border-dashed rounded-lg flex items-center justify-center">
                  <p className="text-white/60 text-xs font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                    Align Aadhaar Card here
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {!capturedImage && mode === "upload" && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-muted/10 transition-colors w-full h-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium">Select Aadhaar Image</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </motion.div>
          )}

          {capturedImage && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full h-full bg-muted"
            >
              <img src={capturedImage} alt="Aadhaar" className="w-full h-full object-contain" />
              
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <Loader2 className="w-10 h-10 animate-spin mb-4" />
                  <p className="text-sm font-medium animate-pulse">Extracting Identity Details...</p>
                </div>
              )}

              {ocrResult && !isProcessing && (
                <div className="absolute top-4 right-4 bg-green-500/90 text-white p-2 rounded-lg shadow-lg flex items-center backdrop-blur-md">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span className="text-xs font-bold tracking-widest">
                    ID DETECTED: {ocrResult.number.replace(/(.{4})/g, "$1 ").trim()}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-3">
        {capturedImage ? (
          <Button variant="outline" className="flex-1" onClick={reset}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Retake
          </Button>
        ) : (
          mode === "camera" && (
            <Button className="flex-1 h-12 text-base font-semibold" onClick={capture} disabled={!isCapturing}>
              <Camera className="w-5 h-5 mr-2" />
              Capture Card
            </Button>
          )
        )}
      </div>

      {error && !isProcessing && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start text-destructive">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
