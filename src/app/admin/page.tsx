
"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Employee, AttendanceRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Download, ArrowLeft, Users, ListChecks, Clock, Loader2, Barcode, CircleUserRound, Lock, Calendar as CalendarIcon } from 'lucide-react';
import { format, differenceInMinutes, parse, formatDistanceStrict, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BarcodeComponent from "react-barcode";
import useLocalStorage from "@/hooks/use-local-storage";
import { useEmployees, addEmployee, removeEmployee } from "@/hooks/use-employees";
import { useAttendance } from "@/hooks/use-attendance";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";


type DailyAttendance = {
    employeeId: string;
    employeeName: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    workIntervals: { in: Date, out: Date | null }[];
    totalHours: number; // in minutes
    scheduledHours: number; // in minutes
    overtimeHours: number; // in minutes
    status: string; // e.g. "On Time", "Late", "Absent", "Early Departure"
};

// Helper function to format HH:mm string to 12-hour AM/PM format
const formatTo12Hour = (timeString: string | null | undefined): string => {
  if (!timeString) return 'N/A';
  try {
    const date = parse(timeString, 'HH:mm', new Date());
    return format(date, 'p');
  } catch (e) {
    console.error("Error formatting time:", e);
    return 'Invalid Time';
  }
};

function formatHoursMinutes(totalMinutes: number | null) {
    if (totalMinutes === null || totalMinutes < 0) return '0h 0m';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

export default function AdminPage() {
  const [isClient, setIsClient] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useLocalStorage("isAdminAuthenticated", false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const { employees, loading: loadingEmployees } = useEmployees();
  const { attendanceLog, loading: loadingAttendance } = useAttendance(dateRange);

  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("10:00");
  const [shiftEndTime, setShiftEndTime] = useState("18:00");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  
  const ADMIN_PASSWORD = "samarth@12345";

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const handleLogin = () => {
    if(password === ADMIN_PASSWORD) {
        setIsAuthenticated(true);
        toast({ title: "Success", description: "Authentication successful."});
        setPassword("");
    } else {
        toast({ variant: "destructive", title: "Authentication Failed", description: "Incorrect password."});
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Employee name cannot be empty." });
      return;
    }
    if (!shiftStartTime || !shiftEndTime) {
        toast({ variant: "destructive", title: "Error", description: "Shift start and end times are required." });
        return;
    }
    
    const newEmployee: Omit<Employee, 'id'> = {
      name: newEmployeeName.trim(),
      shiftStartTime,
      shiftEndTime,
    };
    try {
        await addEmployee(newEmployee);
        // Reset form
        setNewEmployeeName("");
        setShiftStartTime("10:00");
        setShiftEndTime("18:00");
        toast({ title: "Success", description: "Employee added successfully." });
    } catch (error) {
        console.error("Error adding employee:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to add employee." });
    }
  };

  const handleRemoveEmployee = async (id: string) => {
    try {
        await removeEmployee(id);
        toast({ title: "Success", description: "Employee removed." });
    } catch (error) {
        console.error("Error removing employee:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to remove employee." });
    }
  };
  
  const dailyAttendanceLog = useMemo(() => {
    if (loadingEmployees || loadingAttendance || !dateRange?.from || !dateRange?.to) return [];

    const allExpectedDays = new Map<string, DailyAttendance>();
    
    // Step 1: Create an entry for every employee for every day within the selected date range
    if (employees.length > 0) {
      for (const employee of employees) {
        const scheduledHours = (employee.shiftStartTime && employee.shiftEndTime) ? differenceInMinutes(parse(employee.shiftEndTime, "HH:mm", new Date()), parse(employee.shiftStartTime, "HH:mm", new Date())) : 0;

        for (let d = new Date(dateRange.from); d <= dateRange.to; d.setDate(d.getDate() + 1)) {
           const dateStr = format(d, 'yyyy-MM-dd');
           const key = `${employee.id}-${dateStr}`;
           allExpectedDays.set(key, {
                employeeId: employee.id!,
                employeeName: employee.name,
                date: dateStr,
                checkIn: null,
                checkOut: null,
                workIntervals: [],
                totalHours: 0,
                scheduledHours: scheduledHours,
                overtimeHours: 0,
                status: 'Absent'
           });
        }
      }
    }

    // Step 2: Process the attendance log
    const sortedLog = [...attendanceLog].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const record of sortedLog) {
        const dateStr = format(new Date(record.timestamp), 'yyyy-MM-dd');
        const key = `${record.employeeId}-${dateStr}`;
        const entry = allExpectedDays.get(key);
        const employee = employees.find(e => e.id === record.employeeId);
        
        if (!entry || !employee) continue;

        const timestamp = new Date(record.timestamp);
        
        entry.status = 'Present';

        if (record.type === 'IN') {
            if (!entry.checkIn) { // First check-in of the day
                entry.checkIn = timestamp.toISOString();
                if (employee.shiftStartTime) {
                    const shiftStart = parse(employee.shiftStartTime, 'HH:mm', new Date(dateStr));
                    if(timestamp > shiftStart) {
                        entry.status = `Late by ${formatDistanceStrict(timestamp, shiftStart)}`;
                    } else {
                        entry.status = 'On Time';
                    }
                }
            }
            entry.workIntervals.push({ in: timestamp, out: null });
        } else if (record.type === 'OUT') {
            const lastInterval = entry.workIntervals[entry.workIntervals.length - 1];
            if (lastInterval && !lastInterval.out) {
                lastInterval.out = timestamp;
                entry.checkOut = timestamp.toISOString();
            }
             if (employee.shiftEndTime) {
                const shiftEnd = parse(employee.shiftEndTime, 'HH:mm', new Date(dateStr));
                if (timestamp < shiftEnd) {
                    entry.status = `Early Departure`;
                }
            }
        }
    }

    // Step 3: Calculate totals and finalize status
     allExpectedDays.forEach(entry => {
        let totalMinutes = 0;
        entry.workIntervals.forEach(interval => {
            if (interval.in && interval.out) {
                totalMinutes += differenceInMinutes(interval.out, interval.in);
            }
        });
        entry.totalHours = totalMinutes;
        entry.overtimeHours = Math.max(0, totalMinutes - entry.scheduledHours);
        
        // Final status check if present but no checkout
        if(entry.status !== 'Absent' && !entry.checkOut) {
            entry.status = 'Checked In';
        }
    });

    return Array.from(allExpectedDays.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.employeeName.localeCompare(b.employeeName));

  }, [attendanceLog, employees, loadingEmployees, loadingAttendance, dateRange]);


  const downloadCSV = () => {
    const headers = ["Employee Name", "Date", "Check-In", "Check-Out", "Scheduled Hours", "Actual Hours", "Overtime", "Status"];
    const rows = dailyAttendanceLog.map(record => [
        `"${record.employeeName}"`,
        record.date,
        record.checkIn ? format(new Date(record.checkIn), 'p') : 'N/A',
        record.checkOut ? format(new Date(record.checkOut), 'p') : 'N/A',
        `"${formatHoursMinutes(record.scheduledHours)}"`,
        `"${formatHoursMinutes(record.totalHours)}"`,
        `"${formatHoursMinutes(record.overtimeHours)}"`,
        `"${record.status}"`
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_log_${format(dateRange?.from ?? new Date(), 'yyyy-MM-dd')}_to_${format(dateRange?.to ?? new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getStatusColor = (status: string) => {
    if (status === 'On Time' || status === 'Present') return 'bg-green-100 text-green-800';
    if (status.startsWith('Late') || status === 'Early Departure') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Absent') return 'bg-gray-100 text-gray-800';
    if (status === 'Checked In') return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
  };
  
  const renderLoading = () => (
    <TableRow>
      <TableCell colSpan={8} className="text-center h-24">
        <div className="flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading data...</span>
        </div>
      </TableCell>
    </TableRow>
  );

  const downloadBarcode = (employeeName: string, employeeId: string) => {
    const svg = document.getElementById(`barcode-${employeeId}`);
    if (!svg) return;
  
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${employeeName}-barcode.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };
  
   if (isClient && !isAuthenticated) {
    return (
        <main className="min-h-screen bg-muted/40 p-4 sm:p-6 md:p-8 flex items-center justify-center">
             <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2"><Lock /> Admin Access</CardTitle>
                    <CardDescription>Enter the password to access the admin dashboard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input 
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <Button onClick={handleLogin} className="w-full">
                        Login
                    </Button>
                     <Button variant="ghost" asChild className="w-full">
                        <Link href="/">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Scan Page
                        </Link>
                    </Button>
                </CardContent>
             </Card>
        </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
            <div>
                <h1 className="text-4xl font-bold font-headline mt-2">Admin Dashboard</h1>
                <p className="text-muted-foreground">Manage employees and view attendance records.</p>
            </div>
             <Button variant="ghost" onClick={() => setIsAuthenticated(false)}>
                Logout
            </Button>
        </div>

        <Tabs defaultValue="employees">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="employees"><Users className="w-4 h-4 mr-2"/>Manage Employees</TabsTrigger>
            <TabsTrigger value="logs"><ListChecks className="w-4 h-4 mr-2"/>Attendance Log</TabsTrigger>
          </TabsList>
          
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <CardTitle>Add New Employee</CardTitle>
                <CardDescription>
                  Add a new employee to the system with their shift timings. A unique barcode will be generated.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-4">
                    <Input
                        placeholder="Employee Name"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                    />
                    <div className="flex gap-4 items-center w-full">
                        <div className="flex gap-2 items-center w-full">
                            <Label htmlFor="shift-start" className="text-sm">From:</Label>
                            <Input id="shift-start" type="time" value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} className="w-full" />
                        </div>
                        <div className="flex gap-2 items-center w-full">
                            <Label htmlFor="shift-end" className="text-sm">To:</Label>
                            <Input id="shift-end" type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} className="w-full" />
                        </div>
                    </div>
                     <Button onClick={handleAddEmployee} className="w-full" disabled={!isClient || !newEmployeeName}>
                        <UserPlus className="w-4 h-4 mr-2"/> Add Employee
                    </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Employee List</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Shift Time</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingEmployees ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          <div className="flex justify-center items-center">
                              <Loader2 className="w-6 h-6 animate-spin mr-2" />
                              <span>Loading employees...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : employees.length > 0 ? employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                               <AvatarFallback>
                                 <CircleUserRound />
                               </AvatarFallback>
                            </Avatar>
                            <span>{emp.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatTo12Hour(emp.shiftStartTime)} - {formatTo12Hour(emp.shiftEndTime)}</TableCell>
                        <TableCell>
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-2 bg-white rounded-md">
                                    <BarcodeComponent id={`barcode-${emp.id}`} value={emp.id!} width={2} height={50} displayValue={false} />
                                </div>
                                <Button variant="outline" size="sm" onClick={() => downloadBarcode(emp.name, emp.id!)}>
                                    <Download className="w-3 h-3 mr-2" />
                                    Download
                                </Button>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleRemoveEmployee(emp.id!)}>
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">No employees found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle>Daily Attendance Records</CardTitle>
                    <CardDescription>
                      Daily summary of IN/OUT events for each employee.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pick a date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={downloadCSV} disabled={!isClient || dailyAttendanceLog.length === 0}>
                        <Download className="w-4 h-4 mr-2"/> Download CSV
                    </Button>
                  </div>
              </CardHeader>
              <CardContent>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAttendance ? renderLoading() : dailyAttendanceLog.length > 0 ? dailyAttendanceLog.map((record, index) => (
                      <TableRow key={`${record.employeeId}-${record.date}-${index}`}>
                        <TableCell className="font-medium">{record.employeeName}</TableCell>
                        <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                            {record.checkIn ? (
                                <span className="flex items-center text-green-700">
                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                    {format(new Date(record.checkIn), 'p')}
                                </span>
                            ) : (
                                'N/A'
                            )}
                        </TableCell>
                         <TableCell>
                            {record.checkOut ? (
                                <span className="flex items-center text-red-700">
                                     <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                                    {format(new Date(record.checkOut), 'p')}
                                </span>
                            ) : (
                                'N/A'
                            )}
                        </TableCell>
                         <TableCell>
                            <span className="flex items-center font-mono text-sm">
                                <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                                {formatHoursMinutes(record.scheduledHours)}
                            </span>
                        </TableCell>
                        <TableCell>
                            <span className="flex items-center font-mono text-sm">
                                <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                                {formatHoursMinutes(record.totalHours)}
                            </span>
                        </TableCell>
                        <TableCell>
                            <span className={`font-mono text-sm ${record.overtimeHours > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {formatHoursMinutes(record.overtimeHours)}
                            </span>
                        </TableCell>
                        <TableCell>
                           <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                               {record.status}
                           </span>
                        </TableCell>
                      </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center h-24">No attendance records found for the selected period.</TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
