'use client'

import React, { useState, useTransition } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { format, startOfDay, parse } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { DayContent, DayContentProps } from "react-day-picker"
import { useRouter, usePathname } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"
import { type AnnouncementSignup, signUpForAnnouncement } from "@/app/calendar/actions"
import { AddEventForm } from "@/app/calendar/add-event-form"

interface CalendarClientProps {
  guildId: string | null
  adminDiscordId: string | null
  initialSignups: { [day: string]: AnnouncementSignup }
  currentMonthString: string
}

export function CalendarClient({ guildId, adminDiscordId, initialSignups, currentMonthString }: CalendarClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [currentMonth, setCurrentMonth] = useState(parse(currentMonthString, 'yyyy-MM', new Date()))
  const [isPending, startTransition] = useTransition()

  const handleMonthChange = (month: Date) => {
    const newMonthString = format(month, 'yyyy-MM')
    router.push(`${pathname}?month=${newMonthString}`)
  }
  
  const executeSignUp = async (discordId: string) => {
    if (!selectedDate) {
      toast({ title: "No Date Selected", description: "Please select an available date.", variant: "destructive" })
      return
    }
    
    if (!guildId) {
      toast({ title: "Error", description: "Guild ID not configured.", variant: "destructive" })
      return
    }

    startTransition(async () => {
      const monthKey = format(selectedDate, 'yyyy-MM')
      const dayKey = format(selectedDate, 'dd')
      const result = await signUpForAnnouncement(guildId, monthKey, dayKey, discordId)

      if (result.success) {
        toast({ title: "Spot Claimed!", description: `You signed up for announcements on ${format(selectedDate, 'MMMM do')}. ${result.message}` })
        router.refresh()
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" })
      }
    })
  }

  const handleSignUp = () => {
    if (adminDiscordId) {
      executeSignUp(adminDiscordId)
    } else {
      toast({ title: "Error", description: "Could not find your user ID. Please log in again.", variant: "destructive" })
    }
  }
  
  const userSignupsThisMonth = adminDiscordId ? Object.values(initialSignups).filter(s => s.userId === adminDiscordId).length : 0
  const isDateTaken = selectedDate && initialSignups[format(selectedDate, 'dd')]
  const canSignUp = adminDiscordId && userSignupsThisMonth < 5 && !isDateTaken
  
  const CustomDay = (props: DayContentProps) => {
    const dayKey = format(props.date, 'dd')
    const signup = initialSignups[dayKey]
    if (signup) {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <DayContent {...props} />
          <Avatar className="absolute bottom-0 right-0 h-4 w-4 z-0 opacity-80" title={signup.userName}>
            <AvatarImage src={signup.userAvatar} alt={signup.userName} />
            <AvatarFallback>{signup.userName.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      )
    }
    return <DayContent {...props} />
  }

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={setSelectedDate}
      month={currentMonth}
      onMonthChange={handleMonthChange}
      disabled={(date) => date < startOfDay(new Date()) || !!initialSignups[format(date, 'dd')] || !guildId}
      footer={
        <div className="mt-4 flex flex-col gap-4 p-4 pt-0">
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <AddEventForm onEventAdded={() => router.refresh()} guildId={guildId} />
            <Button onClick={handleSignUp} disabled={(!canSignUp && !!adminDiscordId) || isPending} className="w-full sm:w-auto">
              {isPending ? <Loader2 className="mr-2 animate-spin" /> : <UserPlus className="mr-2" />}
              {isDateTaken ? "Spot Taken" : (!canSignUp && !!adminDiscordId) ? "Limit Reached" : "Claim Announcement Spot"}
            </Button>
          </div>
        </div>
      }
      components={{
        DayContent: CustomDay,
      }}
    />
  )
}