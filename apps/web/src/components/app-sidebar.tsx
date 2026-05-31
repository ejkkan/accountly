"use client";

import * as React from "react";
import { FileText, Upload } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Accountly's sidebar nav. Same shape the template's AppSidebar used —
 * `navGroups` → `<NavMain>` blocks — but stripped down to the routes we
 * actually have. New product surfaces (Chart of Accounts, Settings) land
 * as additions to the `navGroups` array.
 */
const data = {
  navGroups: [
    {
      label: "Bookkeeping",
      items: [
        {
          title: "Bills",
          url: "/bills",
          icon: FileText,
        },
        {
          title: "Upload",
          url: "/bills/new",
          icon: Upload,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/bills">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Accountly</span>
                  <span className="truncate text-xs">Invoice → Journal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
