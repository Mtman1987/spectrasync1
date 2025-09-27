

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings, UserPlus, Webhook, Trash, PlusCircle, Coins } from "lucide-react";
import { getAdminInfo, addVip, addPointsToAdmin } from "@/app/actions";
import { addWebhook, getWebhooks, deleteWebhook, type Webhook as WebhookType, getSettings, saveSettings } from "@/app/settings/actions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PointSystemForm } from "@/app/settings/point-system-form";
import { ClipSettingsForm } from "@/app/settings/clip-settings-form";
import { useRouter } from "next/navigation";
import { AdminAccountCard } from "@/components/admin-account-card";

function AddWebhookForm({ guildId, onWebhookAdded }: { guildId: string, onWebhookAdded: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    const handleSubmit = async () => {
        if (!name || !url) {
            toast({ title: "Name and URL required", variant: "destructive" });
            return;
        }
         if (!guildId) {
             toast({ title: "Community not found", description: "Cannot add webhook without a community ID.", variant: "destructive" });
            return;
        }
        startTransition(async () => {
            const result = await addWebhook(guildId, name, url);
            if (result.success) {
                toast({ title: "Webhook Added!" });
                setName("");
                setUrl("");
                setIsOpen(false);
                onWebhookAdded();
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    };

    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><Webhook /> Add Webhook</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Webhook</DialogTitle>
                    <DialogDescription>Add a Discord channel webhook URL for bot notifications.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="webhook-name" className="text-right">Name</Label>
                        <Input id="webhook-name" placeholder="e.g., #mod-chat" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="webhook-url" className="text-right">Webhook URL</Label>
                        <Input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={isPending}>
                        {isPending && <Loader2 className="animate-spin mr-2"/>} Add Webhook
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function WebhooksList({ guildId }: { guildId: string | null }) {
    const { toast } = useToast();
    const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchWebhooks = useCallback(async () => {
        if (!guildId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const fetched = await getWebhooks(guildId);
        setWebhooks(fetched);
        setIsLoading(false);
    }, [guildId]);

    useEffect(() => {
        if (guildId) {
            fetchWebhooks();
        }
    }, [guildId, fetchWebhooks]);

    const handleDelete = async (webhookId: string) => {
        if (!guildId) return;
        const result = await deleteWebhook(guildId, webhookId);
        if (result.success) {
            toast({ title: "Webhook Deleted" });
            fetchWebhooks();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Webhook /> Configured Webhooks</CardTitle>
                <CardDescription>Manage your Discord webhook endpoints for bot notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    {isLoading ? (
                        <Loader2 className="animate-spin" />
                    ) : webhooks.length > 0 ? (
                        webhooks.map((hook) => (
                            <div key={hook.id} className="flex items-center justify-between p-2 border rounded-lg">
                                <p className="font-semibold truncate flex-1" title={hook.url}>{hook.name}</p>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(hook.id)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No webhooks configured.</p>
                    )}
                </div>
            </CardContent>
            <CardFooter>
                {guildId && <AddWebhookForm guildId={guildId} onWebhookAdded={fetchWebhooks} />}
            </CardFooter>
        </Card>
    );
}

function LinkConfigForm({ guildId }: { guildId: string | null }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [baseUrl, setBaseUrl] = useState("http://localhost:9002");
    const [suggestedUrl, setSuggestedUrl] = useState("");

    useEffect(() => {
        if(window) {
            setSuggestedUrl(window.location.origin);
        }
        if (guildId) {
            getSettings(guildId).then(settings => {
                if (settings.appBaseUrl) {
                    setBaseUrl(settings.appBaseUrl);
                }
            })
        }
    }, [guildId]);

    const handleSubmit = async () => {
        if (!guildId) {
            toast({ title: "Community not found", variant: "destructive" });
            return;
        }
        startTransition(async () => {
            const result = await saveSettings(guildId, { appBaseUrl: baseUrl });
            if (result.success) {
                toast({ title: "Link Configuration Saved!" });
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Link Configuration</CardTitle>
                <CardDescription>Set the base URL for all quick-join links. This should be your app&apos;s public domain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="base-url">Application Base URL</Label>
                    <Input id="base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                        Current recommended URL for this environment: <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setBaseUrl(suggestedUrl)}>{suggestedUrl}</Button>
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSubmit} disabled={isPending}>
                    {isPending && <Loader2 className="animate-spin mr-2"/>} Save Link Config
                </Button>
            </CardFooter>
        </Card>
    );
}

function DevToolsCard({ guildId, adminId }: { guildId: string | null, adminId: string | null }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleAddPoints = () => {
        if (!guildId || !adminId) {
            toast({ title: "Error", description: "Cannot add points. Missing community or user ID.", variant: "destructive" });
            return;
        }
        startTransition(async () => {
            const result = await addPointsToAdmin(guildId, adminId, 200);
            if (result.success) {
                toast({ title: "Success!", description: "You have been awarded 200 points." });
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Developer Tools</CardTitle>
                <CardDescription>Use these tools for testing and debugging.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={handleAddPoints} disabled={isPending || !adminId || !guildId}>
                    {isPending ? <Loader2 className="animate-spin mr-2" /> : <Coins className="mr-2" />}
                    Give me 200 points
                 </Button>
            </CardContent>
        </Card>
    );
}


export function SettingsClientPage({ guildId, adminId, initialCommunityInfo }: { guildId: string | null, adminId: string | null, initialCommunityInfo: any }) {
    const router = useRouter();
    const [adminProfile, setAdminProfile] = useState<any>(null);

    const fetchAdminProfile = useCallback(async (id: string) => {
        const { value } = await getAdminInfo(id);
        setAdminProfile(value);
    }, []);
    
    useEffect(() => {
        if (adminId) {
            fetchAdminProfile(adminId);
        }
    }, [adminId, fetchAdminProfile]);
    
    const handleLinkDiscord = () => {
        router.push(`/api/auth/discord`);
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
                    <Settings className="h-8 w-8 text-primary" />
                    Settings
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                    Configure your community, authentication, and integration settings.
                </p>
            </div>
            
             <div className="grid gap-6 lg:grid-cols-2">
                 <AdminAccountCard
                    adminId={adminId}
                    discordInfo={adminProfile?.discordInfo ?? null}
                    twitchInfo={adminProfile?.twitchInfo ?? null}
                    onTwitchChanged={adminId ? () => fetchAdminProfile(adminId) : undefined}
                    onDiscordRelink={handleLinkDiscord}
                />

                <PointSystemForm guildId={guildId} />
                <ClipSettingsForm guildId={guildId} />
                <LinkConfigForm guildId={guildId} />
                <WebhooksList guildId={guildId} />
                <DevToolsCard guildId={guildId} adminId={adminId} />
            </div>
        </div>
    );
}
