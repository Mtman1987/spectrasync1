
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX_HISTORY = 5;

export function ContentHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const fetchHistory = () => {
      const storedHistory = localStorage.getItem("contentHistory");
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    };

    fetchHistory();
    window.addEventListener("storage", fetchHistory);

    return () => {
      window.removeEventListener("storage", fetchHistory);
    };
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("contentHistory", JSON.stringify(history));
    }
  }, [history, isMounted]);

  function handleClearHistory() {
    setHistory([]);
  }

  if (!isMounted) {
    return null; 
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline">Generation History</CardTitle>
        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your entire generation history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory}>
                  Yes, delete it
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item, index) => (
              <div
                key={index}
                className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-muted rounded-md p-4"
              >
                {item}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <p>Your generated content history will appear here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
