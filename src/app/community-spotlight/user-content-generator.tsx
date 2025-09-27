'use client';

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Loader2, Copy } from "lucide-react";
import { generateUserContent } from "@/ai/flows/generate-user-content";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function UserContentGenerator() {
  const [userDraft, setUserDraft] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!userDraft.trim()) {
      toast({
        title: "Draft is empty",
        description: "Please write a draft before generating.",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      setGeneratedContent("");
      const result = await generateUserContent({ userDraft });
      if (result?.showcasePost) {
        setGeneratedContent(result.showcasePost);
        // Add to history
        try {
            const storedHistory = localStorage.getItem("contentHistory") || "[]";
            const history = JSON.parse(storedHistory);
            const newHistory = [result.showcasePost, ...history].slice(0, 5);
            localStorage.setItem("contentHistory", JSON.stringify(newHistory));
            window.dispatchEvent(new Event("storage"));
        } catch (e) {
            console.error("Failed to update content history in localStorage", e);
        }
      } else {
        toast({
          title: "Generation Failed",
          description: "Could not generate content. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({
      title: "Copied to Clipboard!",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">AI Content Assistant</CardTitle>
        <CardDescription>
          Write a rough draft of your announcement or post, and let the AI polish it for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="user-draft">Your Draft</Label>
          <Textarea
            id="user-draft"
            value={userDraft}
            onChange={(e) => setUserDraft(e.target.value)}
            placeholder="e.g., 'hey everyone im live now playing some valorant, come hang out and see if we can get some wins'"
            rows={4}
          />
        </div>
         <div>
          <Label htmlFor="generated-content">Polished Post</Label>
          <Textarea
            id="generated-content"
            value={generatedContent}
            readOnly
            placeholder="Generated content will appear here..."
            rows={6}
            className="whitespace-pre-wrap bg-muted"
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleGenerate} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generate
        </Button>
        {generatedContent && (
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
