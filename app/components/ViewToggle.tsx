"use client";

import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";

export type ViewMode = "day" | "week" | "month";

type Props = {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
};

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => val && onChange(val as ViewMode)}
        className="justify-start space-x-0"
      >
        <ToggleGroupItem className="text-xs md:text-normal 2xl:text-base" value="day">Dia</ToggleGroupItem>
        <ToggleGroupItem className="text-xs md:text-normal 2xl:text-base" value="week">Semana</ToggleGroupItem>
        <ToggleGroupItem className="text-xs md:text-normal 2xl:text-base" value="month">Mês</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
