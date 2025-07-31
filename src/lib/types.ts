export interface Employee {
  id: string;
  name: string;
  shiftDuration: number; // in hours
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  type: 'IN' | 'OUT';
  location: {
    latitude: number;
    longitude: number;
  };
}
