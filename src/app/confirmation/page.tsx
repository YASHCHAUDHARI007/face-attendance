"use client";

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';

function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const name = searchParams.get('name');
  const time = searchParams.get('time');
  const type = searchParams.get('type');

  return (
    <main className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex flex-col items-center justify-center text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <span className="text-2xl font-bold">Attendance Confirmed</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-xl">
            Welcome, <span className="font-semibold text-accent">{name}</span>!
          </p>
          <div className="text-muted-foreground bg-muted p-4 rounded-lg">
            <p>Your attendance has been successfully recorded.</p>
            <p className="font-mono text-lg mt-2">
              <span className="font-bold">{type === 'IN' ? 'Checked-IN' : 'Checked-OUT'}</span> at {time ? new Date(time).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push('/')} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Scan Page
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function ConfirmationPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading confirmation...</div>}>
            <ConfirmationContent />
        </Suspense>
    )
}
