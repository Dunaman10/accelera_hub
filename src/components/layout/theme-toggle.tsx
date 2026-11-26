"use client";

import * as React from "react";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? theme ?? "system" : "system";
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={showLabel ? "sm" : "icon-sm"}
            aria-label="Ubah tema tampilan (Terang / Gelap)"
            className={cn(
              "relative shrink-0 border-border/80 bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
              className
            )}
          />
        }
      >
        {isDark ? (
          <Moon className="size-4 text-brand-teal" />
        ) : (
          <Sun className="size-4 text-brand-navy dark:text-brand-teal" />
        )}
        {showLabel && (
          <span className="text-xs font-medium">
            {currentTheme === "dark"
              ? "Mode Gelap"
              : currentTheme === "light"
              ? "Mode Terang"
              : "Tema Sistem"}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs">
            Tema Tampilan
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="cursor-pointer justify-between"
        >
          <span className="flex items-center gap-2">
            <Sun className="size-4 text-amber-500" />
            <span>Mode Terang</span>
          </span>
          {currentTheme === "light" && (
            <Check className="size-3.5 text-brand-teal" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="cursor-pointer justify-between"
        >
          <span className="flex items-center gap-2">
            <Moon className="size-4 text-brand-teal" />
            <span>Mode Gelap</span>
          </span>
          {currentTheme === "dark" && (
            <Check className="size-3.5 text-brand-teal" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="cursor-pointer justify-between"
        >
          <span className="flex items-center gap-2">
            <Laptop className="size-4 text-muted-foreground" />
            <span>Ikuti Sistem</span>
          </span>
          {currentTheme === "system" && (
            <Check className="size-3.5 text-brand-teal" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
