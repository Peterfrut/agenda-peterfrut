"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/app/components/ui/sidebar";

import { AvatarProfile } from "./AvatarProfile";
import Logo from "./Logo";
import { RoomList } from "./RoomList";

type Props = {
  roomId?: string;
  onRoomChange: (nextRoomId?: string) => void;
};

export function AppSidebar({ roomId, onRoomChange }: Props) {
  const { setOpen, setOpenMobile } = useSidebar(); // fecha o offcanvas em qualquer largura compacta

  function handleRoomChange(nextRoomId?: string) {
    onRoomChange(nextRoomId);
    setOpen(false);
    setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar" className="lg:hidden">
      <SidebarHeader>
        <AvatarProfile />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <RoomList value={roomId} onChange={handleRoomChange} />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Logo />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
