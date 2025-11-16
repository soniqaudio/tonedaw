"use client";

import { useMemo } from "react";
import { Music2 } from "lucide-react";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TopBarMidiControlsProps {
  className?: string;
}

export const TopBarMidiControls = ({ className }: TopBarMidiControlsProps) => {
  const midiAccessState = useMidiStore((s) => s.midiAccessState);
  const midiAccessError = useMidiStore((s) => s.midiAccessError);
  const inputs = useMidiStore((s) => s.devices);
  const selectedInputId = useMidiStore((s) => s.selectedInputId);
  const { selectInput, triggerMidiAccessRequest } = useMidiStore((s) => s.actions);

  const buttonVariant = useMemo(() => {
    if (midiAccessError || midiAccessState === "denied") return "destructive";
    if (midiAccessState === "granted" && inputs.length > 0) return "default";
    return "ghost";
  }, [midiAccessError, midiAccessState, inputs.length]);

  const handleConnectClick = () => {
    triggerMidiAccessRequest();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={buttonVariant}
        size="icon"
        onClick={handleConnectClick}
        disabled={midiAccessState === "requesting"}
        className="h-8 w-8"
        title="Connect MIDI"
      >
        <Music2 className="h-3.5 w-3.5" />
      </Button>
      {inputs.length > 0 && (
        <Select
          value={selectedInputId || ""}
          onValueChange={(value) => selectInput(value || undefined)}
        >
          <SelectTrigger className="h-8 min-w-[10rem] text-xs">
            <SelectValue placeholder="Choose MIDI" />
          </SelectTrigger>
          <SelectContent>
            {inputs.map((input) => (
              <SelectItem key={input.id} value={input.id}>
                {input.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
