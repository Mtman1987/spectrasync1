'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTransition, useEffect } from "react";
import { Loader2, Film, Wand2 } from "lucide-react";
import { getSettings } from "@/app/actions";

const SettingsFormSchema = z.object({
  clipGifWidth: z.coerce.number().min(0, "Value must be positive."),
  clipGifFps: z.coerce.number().min(0, "Value must be positive."),
  clipGifLoop: z.coerce.number().min(0, "Value must be positive."),
  clipGifMaxDurationSeconds: z.coerce
    .number()
    .min(0, "Value must be positive."),
});

export function ClipSettingsForm({
  guildId,
  onSettingsSaved,
}: {
  guildId: string | null;
  onSettingsSaved: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof SettingsFormSchema>>({
    resolver: zodResolver(SettingsFormSchema),
    defaultValues: {
      clipGifWidth: 480,
      clipGifFps: 15,
      clipGifLoop: 0,
      clipGifMaxDurationSeconds: 15,
    },
  });

  useEffect(() => {
    async function fetchSettings() {
      if (guildId) {
        const settings = await getSettings(guildId);
        form.reset(settings);
      }
    }
    fetchSettings();
  }, [form, guildId]);

  async function onSubmit(data: z.infer<typeof SettingsFormSchema>) {
    if (!guildId) {
      toast({
        title: "Error",
        description: "No community selected.",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const { saveSettings } = await import("@/app/settings/actions");
      const result = await saveSettings(guildId, data);
      if (result.success) {
        toast({
          title: "Settings Saved",
          description: "Clip settings have been updated.",
        });
        onSettingsSaved();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline text-base">
              <Film className="w-5 h-5 text-primary" />
              Clip Conversion Settings
            </CardTitle>
            <CardDescription>
              Control the quality and size of GIFs generated from Twitch clips.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clipGifWidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">GIF Width</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clipGifFps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">GIF FPS</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clipGifLoop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">GIF Loop Count</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clipGifMaxDurationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Max Duration (s)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending || !guildId} size="sm">
              {isPending ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <Wand2 className="mr-2" />
              )}
              Save Clip Settings
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
