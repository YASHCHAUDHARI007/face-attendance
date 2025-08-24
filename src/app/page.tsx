
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Barcode, MapPin, Loader2, CheckCircle, ArrowLeft, AlertTriangle, VideoOff, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { Employee, AttendanceRecord } from "@/lib/types";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { useEmployees } from "@/hooks/use-employees";
import { useAttendance, addAttendanceRecord } from "@/hooks/use-attendance";

export default function ScanPage() {
  const [isClient, setIsClient] = useState(false);
  const { employees, loading: loadingEmployees } = useEmployees();
  const { attendanceLog, loading: loadingAttendance } = useAttendance();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isCameraError, setIsCameraError] = useState(false);
  
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const isProcessing = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const startScanner = async (scanner: Html5Qrcode, cameraId: string) => {
    if (isProcessing.current || scanner.isScanning) {
      return;
    }
    
    setStatus("Starting camera...");
    setIsScannerRunning(true);
    isCameraError && setIsCameraError(false);

    const config: Html5QrcodeCameraScanConfig = {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.9);
        return { width: qrboxSize, height: qrboxSize };
      },
      aspectRatio: 1.0,
    };

    try {
      await scanner.start(
        cameraId,
        config,
        (decodedText, _decodedResult) => {
          if (!isProcessing.current) {
            handleAttendance(decodedText);
          }
        },
        (_errorMessage) => {
          // This callback can be ignored to prevent console spam
        }
      );
      setStatus("Ready to scan.");
    } catch (err) {
      console.error("Camera start error:", err);
      setStatus("Camera access denied or error starting camera.");
      setIsCameraError(true);
      setIsScannerRunning(false);
    }
  };

  useEffect(() => {
    if (!isClient) return;

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("qr-reader", { verbose: false });
    }
    const qrCodeScanner = scannerRef.current;

    if (!selectedCameraId) {
      Html5Qrcode.getCameras()
        .then(cameraDevices => {
          if (cameraDevices && cameraDevices.length) {
            setCameras(cameraDevices);
            const backCamera = cameraDevices.find(camera => camera.label.toLowerCase().includes('back'));
            setSelectedCameraId(backCamera ? backCamera.id : cameraDevices[0].id);
          } else {
            setIsCameraError(true);
            setStatus("No cameras found.");
          }
        })
        .catch(err => {
          console.error("Error getting cameras:", err);
          setIsCameraError(true);
          setStatus("Could not get camera permissions.");
        });
    } else {
      startScanner(qrCodeScanner, selectedCameraId);
    }

    return () => {
      if (qrCodeScanner && qrCodeScanner.isScanning) {
        qrCodeScanner.stop().catch(error => {
          console.error("Failed to stop scanner on cleanup", error);
        });
      }
    };
  }, [isClient, selectedCameraId]);

  const handleSwitchCamera = async () => {
    if (cameras.length > 1 && selectedCameraId && scannerRef.current) {
      const qrCodeScanner = scannerRef.current;
      if (qrCodeScanner.isScanning) {
        await qrCodeScanner.stop();
      }
      const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      setSelectedCameraId(cameras[nextIndex].id);
    }
  };

  const handleAttendance = async (employeeId: string) => {
    if (!employeeId || isProcessing.current) {
      return;
    }
    
    isProcessing.current = true;
    setIsLoading(true);

    const qrCodeScanner = scannerRef.current;
    if (qrCodeScanner && qrCodeScanner.isScanning) {
      await qrCodeScanner.stop();
      setIsScannerRunning(false);
    }
    
    setStatus("Verifying Barcode...");
    
    const employee = employees.find(e => e.id === employeeId);
    
    if(!employee){
        setStatus("Employee not found in database.");
        setIsLoading(false);
        toast({ variant: "destructive", title: "Error", description: "Employee not found."});
        setTimeout(() => {
             isProcessing.current = false;
             if(qrCodeScanner && selectedCameraId) startScanner(qrCodeScanner, selectedCameraId);
        }, 3000);
        return;
    }

    setStatus(`Welcome, ${employee.name}. Logging your attendance.`);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        const lastRecord = [...attendanceLog].filter(r => r.employeeId === employee.id).pop();
        const newRecordType = !lastRecord || lastRecord.type === 'OUT' ? 'IN' : 'OUT';

        const newRecord: Omit<AttendanceRecord, 'id'> = {
          employeeId: employee.id!,
          employeeName: employee.name,
          timestamp: new Date().toISOString(),
          type: newRecordType,
          location: { latitude, longitude },
        };
        
        try {
            await addAttendanceRecord(newRecord);
            const confirmationText = `Attendance confirmed for ${employee.name}. Checked ${newRecordType}.`;
            setStatus(confirmationText);
            toast({
                title: "Success",
                description: confirmationText,
                duration: 5000,
            });
        } catch (error) {
             console.error("Error adding attendance record:", error);
             setStatus("Error saving attendance. Please try again.");
             toast({
                variant: "destructive",
                title: "Database Error",
                description: "Could not save your attendance record.",
            });
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                isProcessing.current = false;
                if(qrCodeScanner && selectedCameraId) startScanner(qrCodeScanner, selectedCameraId);
            }, 3000);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          variant: "destructive",
          title: "Location Error",
          description: "Could not get your location. Please enable location services.",
        });
        setStatus("Could not determine your location. Please check browser permissions.");
        setIsLoading(false);
        setTimeout(() => {
            isProcessing.current = false;
            if(qrCodeScanner && selectedCameraId) startScanner(qrCodeScanner, selectedCameraId);
        }, 3000);
      }
    );
  };
  
  const renderSystemStatus = () => {
    if (!isClient) {
      return null;
    }
    if (loadingEmployees) {
        return (
             <div className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span>Loading employee data...</span>
            </div>
        )
    }

    if (employees.length === 0) {
         return (
            <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Registered Employees</AlertTitle>
            <AlertDescription>
                The system is ready, but no employees are registered.
                Please go to the <Link href="/admin" className="underline">Admin Page</Link> to add employees.
            </AlertDescription>
            </Alert>
        );
    }
    return null;
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8 bg-background">
      <div className="w-full max-w-2xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-headline font-bold tracking-tight text-primary-foreground uppercase">
            SAMARTH FURNITURE AND MALL
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            designed by GEN Z STUDIO (yash chaudhari)
          </p>
        </header>
        
        <Card className="overflow-hidden shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-xl md:text-2xl">
              <Barcode className="w-6 h-6 mr-2 text-accent" />
              Scan Barcode for Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="relative w-full max-w-sm aspect-square bg-muted rounded-lg overflow-hidden border">
              <div id="qr-reader" className="w-full h-full" />
              {isCameraError && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white p-4">
                  <VideoOff className="w-12 h-12 mb-4" />
                  <p className="text-lg font-semibold text-center">Camera Error</p>
                  <p className="text-center text-sm">Could not access camera. Please check permissions in your browser settings.</p>
                </div>
              )}
               {cameras.length > 1 && isScannerRunning && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <Button onClick={handleSwitchCamera} variant="outline" size="sm">
                        <Camera className="w-4 h-4 mr-2" />
                        Switch Camera
                    </Button>
                </div>
               )}
            </div>
            <div className="text-center text-muted-foreground h-10 flex items-center justify-center">
              {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{status}</span>
                  </div>
              ) : (
                <p>{status}</p>
              )}
            </div>
            {renderSystemStatus()}
          </CardContent>
          <CardFooter className="flex-col gap-4 pt-6 text-center text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Your location will be recorded for attendance.</span>
            </div>
            <div className="text-xs text-muted-foreground">
                Go to <Link href="/admin" className="underline hover:text-accent">Admin Page</Link> to manage employees.
            </div>
          </CardFooter>
        </Card>
      </div>

    </main>
  );
}
