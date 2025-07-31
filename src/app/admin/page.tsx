"use client";

import { useState } from "react";
import Link from "next/link";
import useLocalStorage from "@/hooks/use-local-storage";
import type { Employee, AttendanceRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Download, ArrowLeft, Users, ListChecks, Camera } from 'lucide-react';
import { format } from 'date-fns';

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

  const downloadCSV = () => {
    const headers = ["Employee Name", "Date", "Time", "Type (IN/OUT)", "Location (Lat,Lon)"];
    const rows = attendanceLog.map(record => [
      record.employeeName,
      format(new Date(record.timestamp), 'yyyy-MM-dd'),
      format(new Date(record.timestamp), 'HH:mm:ss'),
      record.type,
      `${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)}`
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendance_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
                    <CardTitle>Attendance Records</CardTitle>
                    <CardDescription>
                      View all IN/OUT events recorded in the system.
                    </CardDescription>
                  </div>
                  <Button onClick={downloadCSV} disabled={attendanceLog.length === 0}>
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
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceLog.length > 0 ? [...attendanceLog].reverse().map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.employeeName}</TableCell>
                        <TableCell>{format(new Date(record.timestamp), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(record.timestamp), 'p')}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            record.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {record.type}
                          </span>
                        </TableCell>
                      </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24">No attendance records found.</TableCell>
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
