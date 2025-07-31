"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import useLocalStorage from "@/hooks/use-local-storage";
import type { Employee, AttendanceRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Download, ArrowLeft, Users, ListChecks, Camera, Clock, Loader2 } from 'lucide-react';
import { format, differenceInMinutes, parse, formatDistanceStrict } from 'date-fns';

type DailyAttendance = {
    employeeName: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    totalHours: number | null; // in minutes
    shiftStatus: string;
};

export default function AdminPage() {
  const [isClient, setIsClient] = useState(false);
  const [employees, setEmployees] = useLocalStorage<Employee[]>("employees", []);
  const [attendanceLog] = useLocalStorage<AttendanceRecord[]>("attendanceLog", []);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("10:00");
  const [shiftEndTime, setShiftEndTime] = useState("18:00");
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddEmployee = () => {
    if (!newEmployeeName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Employee name cannot be empty." });
      return;
    }
    if (!shiftStartTime || !shiftEndTime) {
        toast({ variant: "destructive", title: "Error", description: "Shift start and end times are required." });
        return;
    }
    const newEmployee: Employee = {
      id: new Date().toISOString(),
      name: newEmployeeName.trim(),
      shiftStartTime,
      shiftEndTime,
    };
    setEmployees([...employees, newEmployee]);
    setNewEmployeeName("");
    setShiftStartTime("10:00");
    setShiftEndTime("18:00");
    toast({ title: "Success", description: "Employee added successfully." });
  };

  const handleRemoveEmployee = (id: string) => {
    setEmployees(employees.filter((emp) => emp.id !== id));
    toast({ title: "Success", description: "Employee removed." });
  };
  
  const dailyAttendanceLog = useMemo(() => {
    const grouped: Record<string, DailyAttendance> = {};

    [...attendanceLog].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(record => {
      const dateStr = format(new Date(record.timestamp), 'yyyy-MM-dd');
      const key = `${record.employeeId}-${dateStr}`;
      const employee = employees.find(e => e.id === record.employeeId);

      if (!grouped[key]) {
        grouped[key] = {
          employeeName: record.employeeName,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          totalHours: null,
          shiftStatus: 'Absent'
        };
      }

      const timestamp = new Date(record.timestamp);
      if (record.type === 'IN' && !grouped[key].checkIn) {
        grouped[key].checkIn = timestamp.toISOString();
        if (employee) {
            const shiftStart = parse(employee.shiftStartTime, 'HH:mm', new Date(dateStr));
            if (timestamp > shiftStart) {
                grouped[key].shiftStatus = `Late by ${formatDistanceStrict(timestamp, shiftStart)}`;
            } else {
                grouped[key].shiftStatus = 'On Time';
            }
        }
      } else if (record.type === 'OUT') {
        grouped[key].checkOut = timestamp.toISOString();
      }
    });
    
    // Calculate total hours
    Object.values(grouped).forEach(entry => {
        if (entry.checkIn && entry.checkOut) {
            entry.totalHours = differenceInMinutes(new Date(entry.checkOut), new Date(entry.checkIn));
        }
    });

    return Object.values(grouped).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.employeeName.localeCompare(b.employeeName));
  }, [attendanceLog, employees]);


  const downloadCSV = () => {
    const headers = ["Employee Name", "Date", "Check-In Time", "Check-Out Time", "Total Hours (minutes)", "Status"];
    const rows = dailyAttendanceLog.map(record => [
        record.employeeName,
        record.date,
        record.checkIn ? format(new Date(record.checkIn), 'HH:mm:ss') : 'N/A',
        record.checkOut ? format(new Date(record.checkOut), 'HH:mm:ss') : 'N/A',
        record.totalHours !== null ? record.totalHours.toString() : 'N/A',
        record.shiftStatus
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "daily_attendance_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  function formatHoursMinutes(totalMinutes: number | null) {
    if (totalMinutes === null || totalMinutes < 0) return 'N/A';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
  
  const renderLoading = () => (
    <TableRow>
      <TableCell colSpan={6} className="text-center h-24">
        <div className="flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading data...</span>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
            <Button variant="ghost" asChild>
                <Link href="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Scan Page
                </Link>
            </Button>
            <h1 className="text-4xl font-bold font-headline mt-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage employees and view attendance records.</p>
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
                  Add a new employee to the system with their shift timings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <Input
                    placeholder="Employee Name"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    className="flex-grow"
                  />
                   <div className="flex gap-2 items-center w-full sm:w-auto">
                     <Label htmlFor="shift-start" className="text-sm">From:</Label>
                     <Input
                        id="shift-start"
                        type="time"
                        value={shiftStartTime}
                        onChange={(e) => setShiftStartTime(e.target.value)}
                        className="w-full"
                      />
                   </div>
                   <div className="flex gap-2 items-center w-full sm:w-auto">
                    <Label htmlFor="shift-end" className="text-sm">To:</Label>
                    <Input
                      id="shift-end"
                      type="time"
                      value={shiftEndTime}
                      onChange={(e) => setShiftEndTime(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button onClick={handleAddEmployee} className="w-full sm:w-auto" disabled={!isClient}>
                    <UserPlus className="w-4 h-4 mr-2"/> Add Employee
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Camera className="w-4 h-4"/>
                    For this demo, face recognition is simulated. The system will identify the first user in the list during check-in.
                </p>
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
                      <TableHead>Name</TableHead>
                      <TableHead>Shift Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isClient ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          <div className="flex justify-center items-center">
                              <Loader2 className="w-6 h-6 animate-spin mr-2" />
                              <span>Loading employees...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : employees.length > 0 ? employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell>{emp.shiftStartTime} - {emp.shiftEndTime}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleRemoveEmployee(emp.id)}>
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">No employees found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Daily Attendance Records</CardTitle>
                    <CardDescription>
                      Daily summary of IN/OUT events for each employee.
                    </CardDescription>
                  </div>
                  <Button onClick={downloadCSV} disabled={!isClient || dailyAttendanceLog.length === 0}>
                    <Download className="w-4 h-4 mr-2"/> Download CSV
                  </Button>
              </CardHeader>
              <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Check-In</TableHead>
                      <TableHead>Check-Out</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isClient ? renderLoading() : dailyAttendanceLog.length > 0 ? dailyAttendanceLog.map((record, index) => (
                      <TableRow key={`${record.employeeName}-${record.date}-${index}`}>
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
                                {formatHoursMinutes(record.totalHours)}
                            </span>
                        </TableCell>
                        <TableCell>
                           <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                               record.shiftStatus === 'On Time' ? 'bg-green-100 text-green-800' : 
                               record.shiftStatus === 'Absent' ? 'bg-gray-100 text-gray-800' :
                               'bg-yellow-100 text-yellow-800'
                           }`}>
                               {record.shiftStatus}
                           </span>
                        </TableCell>
                      </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24">No attendance records found.</TableCell>
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
