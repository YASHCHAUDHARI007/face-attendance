
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceRecord } from '@/lib/types';
import { DateRange } from 'react-day-picker';

export function useAttendance(dateRange?: DateRange) {
  const [attendanceLog, setAttendanceLog] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Default to last 30 days if no range is provided
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 29);
    
    const startDate = dateRange?.from || defaultStartDate;
    const endDate = dateRange?.to || new Date();

    // Ensure start of the day for 'from' and end of the day for 'to'
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const attendanceCollection = collection(db, 'attendanceLog');
    
    const q = query(
      attendanceCollection,
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc')
    );
    
    setLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        logData.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });
      setAttendanceLog(logData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching attendance log:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dateRange]);

  return { attendanceLog, loading };
}

export async function addAttendanceRecord(record: Omit<AttendanceRecord, 'id'>) {
  try {
    // Use Firestore Server Timestamp for accuracy
    const recordWithTimestamp = {
        ...record,
        timestamp: new Date(record.timestamp), // Ensure it's a Date object for Firestore
    };
    await addDoc(collection(db, 'attendanceLog'), recordWithTimestamp);
  } catch (error) {
    console.error("Error adding attendance record: ", error);
    throw error;
  }
}
