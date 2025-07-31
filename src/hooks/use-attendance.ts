
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AttendanceRecord } from '@/lib/types';

export function useAttendance() {
  const [attendanceLog, setAttendanceLog] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'attendanceLog'), orderBy('timestamp', 'desc'));
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
  }, []);

  return { attendanceLog, loading };
}

export async function addAttendanceRecord(record: Omit<AttendanceRecord, 'id'>) {
  try {
    await addDoc(collection(db, 'attendanceLog'), record);
  } catch (error) {
    console.error("Error adding attendance record: ", error);
    throw error;
  }
}
