import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BrainCircuit, FolderKanban, LayoutDashboard, LogOut, PanelLeft, Radio, SearchCheck, FileText } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Radio, label: "Research", path: "/research" },
  { icon: FolderKanban, label: "Collections", path: "/collections" },
  { icon: SearchCheck, label: "Ask Mode", path: "/ask" },
  { icon: FileText, label: "Reports", path: "/reports" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="intelis-workspace relative grid min-h-screen overflow-hidden lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative hidden overflow-hidden bg-[#11162e] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_25%_20%,rgba(138,108,255,0.32),transparent_21rem),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:auto,32px_32px,32px_32px]" />
          <div className="relative flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#11162e]"><BrainCircuit className="h-5 w-5" /></span><div><p className="font-display text-2xl tracking-[-0.05em]">Intelis</p><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-200">Research system</p></div></div>
          <div className="relative max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">Continuous intelligence</p><h1 className="mt-5 font-display text-5xl leading-[1.02] tracking-[-0.05em]">See what changed.<br />Know what matters.</h1><p className="mt-6 max-w-md text-sm leading-7 text-slate-300">A deliberate workspace for questions, source evidence, and the signals that emerge between research runs.</p></div>
          <p className="relative text-xs text-slate-400">Evidence-first research orchestration.</p>
        </div>
        <div className="relative flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-sm"><div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#11162e] text-white"><BrainCircuit className="h-4 w-4" /></span><div><p className="font-display text-xl tracking-[-0.05em] text-slate-950">Intelis</p><p className="text-[8px] font-bold uppercase tracking-[0.2em] text-violet-600">Research system</p></div></div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Secure workspace</p><h2 className="mt-3 font-display text-4xl tracking-[-0.045em] text-slate-950">Welcome back.</h2><p className="mt-3 text-sm leading-6 text-slate-500">Sign in to configure research tasks and access the intelligence your pipelines have accumulated.</p><Button onClick={() => startLogin()} size="lg" className="mt-8 h-12 w-full rounded-xl bg-[#11162e] text-white shadow-[0_8px_20px_rgb(17_22_46/0.18)] hover:bg-[#242b50]">Sign in to Intelis</Button></div></div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-slate-200/70 bg-[#fbfbfc]"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-20 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#12172f] text-white shadow-[0_5px_16px_rgb(18_23_47/0.22)]"><BrainCircuit className="h-4 w-4" /></span>
                  <div className="min-w-0 leading-none"><span className="font-display block truncate text-lg font-semibold tracking-[-0.05em] text-slate-950">Intelis</span><span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.22em] text-violet-600">Research system</span></div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {!isCollapsed && <div className="px-5 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</div>}
            <SidebarMenu className="px-3 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 rounded-lg border-l-2 transition-all font-medium text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 data-[active=true]:border-violet-600 data-[active=true]:bg-violet-100/80 data-[active=true]:text-violet-800`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1"><span className="font-display tracking-[-0.03em] text-foreground">{activeMenuItem?.label ?? "Menu"}</span></div>
              </div>
            </div>
          </div>
        )}
        <main className="intelis-workspace flex-1 p-4 md:p-7">{children}</main>
      </SidebarInset>
    </>
  );
}
