
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QrCode, MapPin, Loader2, CheckCircle, ArrowLeft, AlertTriangle, VideoOff, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { Employee, AttendanceRecord } from "@/lib/types";
import useLocalStorage from "@/hooks/use-local-storage";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";


type ConfirmationDetails = {
  name: string;
  time: string;
  type: 'IN' | 'OUT';
} | null;

export default function ScanPage() {
  const [isClient, setIsClient] = useState(false);
  const [employees] = useLocalStorage<Employee[]>("employees", []);
  const [attendanceLog, setAttendanceLog] = useLocalStorage<AttendanceRecord[]>("attendanceLog", []);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [confirmationDetails, setConfirmationDetails] = useState<ConfirmationDetails>(null);
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isCameraError, setIsCameraError] = useState(false);
  
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(undefined);
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const isProcessing = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect to initialize the scanner and get camera devices
  useEffect(() => {
    if (!isClient) return;

    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader", { verbose: false });
    }
    const qrCodeScanner = scannerRef.current;

    const setupScanner = async () => {
        try {
            const cameraDevices = await Html5Qrcode.getCameras();
            if (cameraDevices && cameraDevices.length) {
                setCameras(cameraDevices);
                // Prioritize back camera ('environment')
                const backCamera = cameraDevices.find(camera => camera.label.toLowerCase().includes('back'));
                const initialCameraId = backCamera ? backCamera.id : cameraDevices[0].id;
                setSelectedCameraId(initialCameraId);
                setStatus("Ready to scan.");
            } else {
                setIsCameraError(true);
                setStatus("No cameras found.");
            }
        } catch (err) {
            console.error("Error getting cameras:", err);
            setIsCameraError(true);
            setStatus("Could not get camera permissions.");
        }
    };
    
    setupScanner();

    return () => {
      if (qrCodeScanner && qrCodeScanner.isScanning) {
        qrCodeScanner.stop().catch(error => {
          console.error("Failed to stop scanner on cleanup", error);
        });
      }
    };
  }, [isClient]);
  
  // Effect to start/stop the scanner when camera or confirmation dialog changes
  useEffect(() => {
    if (!selectedCameraId || !isClient) return;

    const qrCodeScanner = scannerRef.current;
    if (!qrCodeScanner) return;
    
    const startScanner = async () => {
        if (confirmationDetails) {
             if (qrCodeScanner.isScanning) {
                await qrCodeScanner.stop();
                setIsScannerRunning(false);
            }
            return;
        }

        if (qrCodeScanner.isScanning) {
           await qrCodeScanner.stop();
        }

        setStatus("Starting camera...");
        isProcessing.current = false; // Reset processing flag
        try {
            const config: Html5QrcodeCameraScanConfig = { 
                fps: 10,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdge * 0.7);
                    return { width: qrboxSize, height: qrboxSize };
                },
                aspectRatio: 1.0,
            };

            await qrCodeScanner.start(
                selectedCameraId,
                config,
                (decodedText, _decodedResult) => {
                   if (!isProcessing.current) {
                       isProcessing.current = true;
                       handleAttendance(decodedText);
                   }
                },
                (_errorMessage) => {
                    // This callback can be ignored to prevent console spam
                }
            );
            setIsScannerRunning(true);
            setStatus("Ready to scan.");
            setIsCameraError(false);
        } catch (err: any) {
            console.error("Camera start error:", err);
            setStatus("Camera access denied or error starting camera.");
            setIsCameraError(true);
            setIsScannerRunning(false);
        }
    };
    
    startScanner();

  }, [selectedCameraId, isClient, confirmationDetails]);


  const handleSwitchCamera = () => {
      if (cameras.length > 1 && selectedCameraId) {
          const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
          const nextIndex = (currentIndex + 1) % cameras.length;
          setSelectedCameraId(cameras[nextIndex].id);
      }
  };


  const handleAttendance = async (employeeId: string) => {
    if (!employeeId) {
        toast({
            variant: "destructive",
            title: "Scan Error",
            description: "Invalid QR code.",
        });
        isProcessing.current = false;
        return;
    }
    
    setIsLoading(true);
    setStatus("Verifying QR Code...");
    
    const employee = employees.find(e => e.id === employeeId);
    
    if(!employee){
        setStatus("Employee not found in database.");
        setIsLoading(false);
        toast({ variant: "destructive", title: "Error", description: "Employee not found."});
        setTimeout(() => {
             setStatus("Ready to scan.")
             isProcessing.current = false;
        }, 3000);
        return;
    }

    setStatus(`Welcome, ${employee.name}. Logging your attendance.`);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        const lastRecord = [...attendanceLog].filter(r => r.employeeId === employee.id).pop();
        const newRecordType = !lastRecord || lastRecord.type === 'OUT' ? 'IN' : 'OUT';

        const newRecord: AttendanceRecord = {
          id: new Date().toISOString(),
          employeeId: employee.id,
          employeeName: employee.name,
          timestamp: new Date().toISOString(),
          type: newRecordType,
          location: { latitude, longitude },
        };

        setAttendanceLog([...attendanceLog, newRecord]);
        setIsLoading(false);

        setConfirmationDetails({
            name: employee.name,
            time: newRecord.timestamp,
            type: newRecord.type
        });
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
            setStatus("Ready to scan.")
            isProcessing.current = false;
        }, 3000);
      }
    );
  };
  
  const closeConfirmation = () => {
    setConfirmationDetails(null);
    setStatus("Ready for next scan.");
    isProcessing.current = false;
  }
  
  const renderSystemStatus = () => {
    if (!isClient) {
      return null;
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
              <QrCode className="w-6 h-6 mr-2 text-accent" />
              Scan QR Code for Attendance
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

       {confirmationDetails && isClient && (
        <AlertDialog open={!!confirmationDetails} onOpenChange={() => closeConfirmation()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <span className="text-2xl font-bold">Attendance Confirmed</span>
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 text-center">
              <p className="text-xl">
                Welcome, <span className="font-semibold text-accent">{confirmationDetails.name}</span>!
              </p>
              <div className="text-muted-foreground bg-muted p-4 rounded-lg">
                <p>Your attendance has been successfully recorded.</p>
                <p className="font-mono text-lg mt-2">
                  <span className="font-bold">{confirmationDetails.type === 'IN' ? 'Checked-IN' : 'Checked-OUT'}</span> at {new Date(confirmationDetails.time).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => closeConfirmation()} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Scan Page
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </main>
  );
}
