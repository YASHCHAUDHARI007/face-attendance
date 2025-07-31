
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Camera, MapPin, Loader2, UserCheck, CheckCircle, ArrowLeft, AlertTriangle } from "lucide-react";
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
import { loadModels, getFullFaceDescription, createMatcher, isFaceDetectionModelLoaded } from '@/lib/face-api';

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
  const [status, setStatus] = useState("Initializing Camera...");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState<ConfirmationDetails>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const [faceMatcher, setFaceMatcher] = useState<any>(null); // Using 'any' for faceMatcher from face-api.js

  // Effect to set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect to load models and create matcher
  useEffect(() => {
    if (isClient) {
      const setupFaceAPI = async () => {
        if (!isFaceDetectionModelLoaded()) {
          setStatus("Loading AI Models...");
          await loadModels();
        }
        setModelsLoaded(true);
        
        const employeesWithPhotos = employees.filter(e => e.photoDataUri);
        if (employeesWithPhotos.length > 0) {
          console.log('Creating face matcher...');
          const matcher = await createMatcher(employeesWithPhotos);
          setFaceMatcher(matcher);
          console.log('Face matcher created.');
        } else {
          setFaceMatcher(null);
        }
      };
      setupFaceAPI();
    }
  }, [isClient, employees]);
  
  // Effect to update status based on state
  useEffect(() => {
    if (!isCameraReady) {
        setStatus("Initializing Camera...");
    } else if (!modelsLoaded || (employees.length > 0 && !faceMatcher)) {
        setStatus("Loading AI Models, please wait...");
    } else {
        setStatus("Please position your face in the camera and mark your attendance.");
    }
  }, [isCameraReady, modelsLoaded, faceMatcher, employees.length]);


  const startWebcam = useCallback(async () => {
    if (isCameraReady) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setStatus("Could not access camera. Please check permissions.");
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Could not access camera. Please ensure permissions are granted.",
      });
    }
  }, [isCameraReady, toast]);

  useEffect(() => {
    if(isClient){
        startWebcam();
    }
    return () => {
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isClient, startWebcam]);

  const handleAttendance = async () => {
    if (!webcamRef.current || !faceMatcher) {
        toast({
            variant: "destructive",
            title: "System Not Ready",
            description: "Face recognition is not ready. Please ensure employees are registered with photos.",
        });
        return;
    }

    setIsLoading(true);
    setStatus("Detecting face...");

    const fullFaceDescription = await getFullFaceDescription(webcamRef.current);
    
    if (!fullFaceDescription) {
        setStatus("No face detected. Please position yourself clearly in the frame.");
        setIsLoading(false);
        return;
    }

    setStatus("Verifying your identity...");
    const bestMatch = faceMatcher.findBestMatch(fullFaceDescription.descriptor);

    if (bestMatch.label === 'unknown') {
        setStatus("Could not recognize face. Please try again or register your face with an admin.");
        setIsLoading(false);
        return;
    }
    
    // We have a match! The label is the employee ID.
    const employee = employees.find(e => e.id === bestMatch.label);
    
    if(!employee){
        setStatus("Employee not found in database.");
        setIsLoading(false);
        return;
    }

    setStatus(`Welcome, ${employee.name}. Logging your attendance.`);

    // Get Geolocation
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Determine IN/OUT status
        const lastRecord = [...attendanceLog].filter(r => r.employeeId === employee.id).pop();
        const newRecordType = !lastRecord || lastRecord.type === 'OUT' ? 'IN' : 'OUT';

        // Create and save attendance record
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

        // Show confirmation dialog
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
      }
    );
  };
  
  const closeConfirmation = () => {
    setConfirmationDetails(null);
    setStatus("Please position your face in the camera and mark your attendance.");
  }
  
  const renderSystemStatus = () => {
    if (!isClient) {
      return null; // Don't render anything server-side
    }
    if (modelsLoaded && !faceMatcher && employees.length > 0) {
      return (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Face Data Missing</AlertTitle>
          <AlertDescription>
            The system is ready, but some employees are missing photos.
            Please go to the <Link href="/admin" className="underline">Admin Page</Link> to register all faces.
          </AlertDescription>
        </Alert>
      );
    }
    if (modelsLoaded && employees.length === 0) {
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

  const isSystemReady = isClient && isCameraReady && modelsLoaded && (faceMatcher || employees.length === 0);

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
              <Camera className="w-6 h-6 mr-2 text-accent" />
              Attendance Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="relative w-full max-w-md aspect-video bg-muted rounded-lg overflow-hidden border">
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <p className="text-center text-muted-foreground">{status}</p>
            {renderSystemStatus()}
            <Button
              onClick={handleAttendance}
              disabled={isLoading || !isSystemReady}
              size="lg"
              className="w-full max-w-xs text-lg font-semibold"
            >
              {isLoading || !isSystemReady ? (
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              ) : (
                <UserCheck className="w-6 h-6 mr-2" />
              )}
              Mark IN/OUT
            </Button>
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
        <AlertDialog open={!!confirmationDetails} onOpenChange={closeConfirmation}>
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
              <AlertDialogAction onClick={closeConfirmation} className="w-full">
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
