"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import useLocalStorage from "@/hooks/use-local-storage";
import type { Employee, AttendanceRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Download, ArrowLeft, Users, ListChecks, Camera, Clock } from 'lucide-react';
import { format, differenceInMinutes, formatDistanceStrict } from 'date-fns';

type DailyAttendance = {
    employeeName: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    totalHours: number | null; // in minutes
};

export default function AdminPage() {
  const [employees, setEmployees] = useLocalStorage<Employee[]>("employees", []);
  const [attendanceLog] = useLocalStorage<AttendanceRecord[]>("attendanceLog", []);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [shiftDuration, setShiftDuration] = useState(8);
  const { toast } = useToast();

  const handleAddEmployee = () => {
    if (!newEmployeeName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Employee name cannot be empty." });
      return;
    }
    if (shiftDuration <= 0) {
        toast({ variant: "destructive", title: "Error", description: "Shift duration must be positive." });
        return;
    }
    const newEmployee: Employee = {
      id: new Date().toISOString(),
      name: newEmployeeName.trim(),
      shiftDuration: shiftDuration,
    };
    setEmployees([...employees, newEmployee]);
    setNewEmployeeName("");
    setShiftDuration(8);
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

      if (!grouped[key]) {
        grouped[key] = {
          employeeName: record.employeeName,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          totalHours: null
        };
      }

      const timestamp = new Date(record.timestamp);
      if (record.type === 'IN' && !grouped[key].checkIn) {
        grouped[key].checkIn = timestamp.toISOString();
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
  }, [attendanceLog]);


  const downloadCSV = () => {
    const headers = ["Employee Name", "Date", "Check-In Time", "Check-Out Time", "Total Hours (minutes)"];
    const rows = dailyAttendanceLog.map(record => [
        record.employeeName,
        record.date,
        record.checkIn ? format(new Date(record.checkIn), 'HH:mm:ss') : 'N/A',
        record.checkOut ? format(new Date(record.checkOut), 'HH:mm:ss') : 'N/A',
        record.totalHours !== null ? record.totalHours.toString() : 'N/A'
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

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes < 0) return 'N/A';
    const date = new Date(0);
    date.setMinutes(minutes);
    return formatDistanceStrict(new Date(0), date, { unit: 'hour' }) + ' ' + formatDistanceStrict(new Date(0), date, { unit: 'minute' }).replace(/\d+\s\w+/,'');
  }
  
  function formatHoursMinutes(totalMinutes: number | null) {
    if (totalMinutes === null || totalMinutes < 0) return 'N/A';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
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
                  Add a new employee to the system. Face data will be simulated upon first check-in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    placeholder="Employee Name"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    className="flex-grow"
                  />
                  <Input
                    type="number"
                    placeholder="Shift Duration (hours)"
                    value={shiftDuration}
                    onChange={(e) => setShiftDuration(Number(e.target.value))}
                    min="1"
                    className="w-full sm:w-48"
                  />
                  <Button onClick={handleAddEmployee} className="w-full sm:w-auto">
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
                      <TableHead>Shift Duration</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length > 0 ? employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell>{emp.shiftDuration} hours</TableCell>
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
                  <Button onClick={downloadCSV} disabled={dailyAttendanceLog.length === 0}>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyAttendanceLog.length > 0 ? dailyAttendanceLog.map((record, index) => (
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
                      </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">No attendance records found.</TableCell>
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
