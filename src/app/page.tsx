
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Barcode, MapPin, Loader2, CheckCircle, AlertTriangle, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { Employee, AttendanceRecord } from "@/lib/types";
import { useEmployees } from "@/hooks/use-employees";
import { useAttendance, addAttendanceRecord } from "@/hooks/use-attendance";
import { Input } from "@/components/ui/input";

export default function ScanPage() {
  const [isClient, setIsClient] = useState(false);
  const { employees, loading: loadingEmployees } = useEmployees();
  const { attendanceLog } = useAttendance();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Ready for scanning.");
  const [scannedCode, setScannedCode] = useState("");
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    setIsClient(true);
    // Auto-focus the input field when the component mounts
    inputRef.current?.focus();
  }, []);

  const handleAttendance = async (employeeId: string) => {
    if (!employeeId || isProcessing.current) {
      return;
    }
    
    isProcessing.current = true;
    setIsLoading(true);
    setStatus("Verifying Barcode...");
    
    const employee = employees.find(e => e.id === employeeId);
    
    if(!employee){
        setStatus("Employee not found in database.");
        setIsLoading(false);
        toast({ variant: "destructive", title: "Error", description: "Employee not found."});
        setTimeout(() => {
             isProcessing.current = false;
             setScannedCode(""); // Clear input
             setStatus("Ready for scanning.");
             inputRef.current?.focus();
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
                setScannedCode(""); // Clear input
                setStatus("Ready for scanning.");
                inputRef.current?.focus();
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
            setScannedCode(""); // Clear input
            setStatus("Ready for scanning.");
            inputRef.current?.focus();
        }, 3000);
      }
    );
  };
  
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(scannedCode.trim()) {
        handleAttendance(scannedCode.trim());
    }
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
            <div className="w-full max-w-sm text-center">
                <div className="p-4 bg-muted rounded-lg border flex flex-col items-center justify-center h-48">
                    <Keyboard className="w-16 h-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Use your barcode scanner to capture the ID.</p>
                </div>

                <form onSubmit={handleFormSubmit}>
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Waiting for scan..."
                        value={scannedCode}
                        onChange={(e) => setScannedCode(e.target.value)}
                        className="w-full mt-4"
                        disabled={isLoading}
                        // Use onBlur to re-focus, helps with some scanner models
                        onBlur={() => { if (!isLoading) inputRef.current?.focus()}}
                    />
                    {/* Hidden submit button to allow form submission on Enter key press */}
                    <button type="submit" className="hidden"></button>
                </form>
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
