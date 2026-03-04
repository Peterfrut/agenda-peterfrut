"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
} from "@/app/components/ui/sidebar"

import { AvatarProfile } from "./AvatarProfile"
import Logo from "./Logo"
import { MY_AGENDA_ID, RoomList } from "./RoomList"
import { useState } from "react"
import type { Booking } from "@/lib/types/booking"

const DEFAULT_ROOM_ID = MY_AGENDA_ID

export function AppSidebar() {
  const [roomId, setRoomId] = useState<string | undefined>(DEFAULT_ROOM_ID)

  const [, setBookingPanelOpen] = useState(false)
  const [, setDetailsBooking] = useState<Booking | null>(null)
  const [, setRescheduleOpen] = useState(false)
  const [, setDetailsError] = useState<string | null>(null)
  const [roomSwitching, setRoomSwitching] = useState(false)

  function handleRoomChange(nextRoomId?: string) {
    setBookingPanelOpen(false)
    setDetailsBooking(null)
    setRescheduleOpen(false)
    setDetailsError(null)
    setRoomSwitching(true)
    setRoomId(nextRoomId)
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="sidebar"
      className="lg:hidden"
    >
      <SidebarHeader>
        <AvatarProfile />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className={roomSwitching ? "pointer-events-none opacity-60" : ""}>
          <RoomList value={roomId} onChange={handleRoomChange} />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Logo />
      </SidebarFooter>

      {/* rail para alternar/arrastar clique e ajudar UX do collapse */}
      <SidebarRail />
    </Sidebar>
  )
}