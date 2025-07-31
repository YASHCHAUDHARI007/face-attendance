"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, MapPin, Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Employee, AttendanceRecord } from "@/lib/types";
import useLocalStorage from "@/hooks/use-local-storage";

export default function ScanPage() {
  const [employees] = useLocalStorage<Employee[]>("employees", []);
  const [attendanceLog, setAttendanceLog] = useLocalStorage<AttendanceRecord[]>("attendanceLog", []);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Please position your face in the camera and mark your attendance.");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const startWebcam = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    startWebcam();
    return () => {
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startWebcam]);

  const handleAttendance = async () => {
    setIsLoading(true);
    setStatus("Verifying your identity and location...");

    if (employees.length === 0) {
      toast({
        variant: "destructive",
        title: "No Employees Registered",
        description: "Please ask an admin to register employees first.",
      });
      setIsLoading(false);
      setStatus("No employees registered. Admin setup required.");
      return;
    }
    
    // 1. Get Geolocation
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // 2. Face Recognition (Simulated)
        // In a real app, this would involve an API call to a face recognition service.
        // For this demo, we'll assume the first registered employee is the one checking in.
        const employee = employees[0];
        setStatus(`Welcome, ${employee.name}. Logging your attendance.`);
        
        // 3. Determine IN/OUT status
        const lastRecord = attendanceLog.filter(r => r.employeeId === employee.id).pop();
        const newRecordType = !lastRecord || lastRecord.type === 'OUT' ? 'IN' : 'OUT';

        // 4. Create and save attendance record
        const newRecord: AttendanceRecord = {
          id: new Date().toISOString(),
          employeeId: employee.id,
          employeeName: employee.name,
          timestamp: new Date().toISOString(),
          type: newRecordType,
          location: { latitude, longitude },
        };

        setAttendanceLog([...attendanceLog, newRecord]);

        toast({
          title: "Success!",
          description: `Attendance for ${employee.name} marked as ${newRecordType}.`,
        });

        router.push(
          `/confirmation?name=${employee.name}&time=${newRecord.timestamp}&type=${newRecord.type}`
        );
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
            <Button
              onClick={handleAttendance}
              disabled={isLoading || !isCameraReady}
              size="lg"
              className="w-full max-w-xs text-lg font-semibold"
            >
              {isLoading ? (
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
    </main>
  );
}
