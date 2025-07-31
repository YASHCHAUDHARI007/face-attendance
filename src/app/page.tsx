
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QrCode, MapPin, Loader2, CheckCircle, ArrowLeft, AlertTriangle, VideoOff } from "lucide-react";
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
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";


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

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const qrCodeScanner = new Html5Qrcode("qr-reader");
    scannerRef.current = qrCodeScanner;
    
    const startScanner = async () => {
        setStatus("Please grant camera permissions.");
        try {
            await qrCodeScanner.start(
                { facingMode: "user" },
                { 
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText, _decodedResult) => {
                    if (decodedText && !isLoading && !confirmationDetails) {
                       handleAttendance(decodedText);
                    }
                },
                (_errorMessage) => {
                    // console.log("QR Scan Error:", errorMessage);
                }
            );
            setStatus("Ready to scan.");
            setIsCameraError(false);
        } catch (err: any) {
            console.error("Camera start error:", err);
            setStatus("Camera access denied or no camera found.");
            setIsCameraError(true);
        }
    };
    
    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.stop().catch(error => {
          console.error("Failed to stop scanner", error);
        });
      }
    };
  }, [isClient]);


  const handleAttendance = async (employeeId: string) => {
    if (!employeeId) {
        toast({
            variant: "destructive",
            title: "Scan Error",
            description: "Invalid QR code.",
        });
        return;
    }
    
    // Prevent multiple triggers for the same scan
    if (employeeId === scanResult) return;
    setScanResult(employeeId);

    setIsLoading(true);
    setStatus("Verifying QR Code...");
    
    const employee = employees.find(e => e.id === employeeId);
    
    if(!employee){
        setStatus("Employee not found in database.");
        setIsLoading(false);
        // Reset scan result to allow re-scanning
        setTimeout(() => setScanResult(null), 3000);
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
        // Reset scan result to allow re-scanning
        setTimeout(() => setScanResult(null), 3000);
      }
    );
  };
  
  const closeConfirmation = () => {
    setConfirmationDetails(null);
    setStatus("Ready for next scan.");
    // Reset scan result to allow re-scanning
    setTimeout(() => setScanResult(null), 1000);
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
