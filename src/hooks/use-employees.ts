
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Employee } from '@/lib/types';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeesData: Employee[] = [];
      snapshot.forEach((doc) => {
        employeesData.push({ id: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(employeesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching employees:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { employees, loading };
}

export async function addEmployee(employee: Omit<Employee, 'id'>) {
  try {
    await addDoc(collection(db, 'employees'), employee);
  } catch (error) {
    console.error("Error adding employee: ", error);
    throw error;
  }
}

export async function removeEmployee(id: string) {
  try {
    await deleteDoc(doc(db, 'employees', id));
  } catch (error) {
    console.error("Error removing employee: ", error);
    throw error;
  }
}
