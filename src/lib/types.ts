
export interface Employee {
  id: string;
  name: string;
  shiftStartTime: string; // e.g., "10:00"
  shiftEndTime: string;   // e.g., "18:00"
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
