import * as React from "react"
import { cn } from "cn"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DropdownProps } from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function CalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: DropdownProps) {
  return (
    <Select
      value={value === undefined ? undefined : String(value)}
      disabled={disabled}
      onValueChange={(next) =>
        onChange?.({
          target: { value: next },
        } as React.ChangeEvent<HTMLSelectElement>)
      }
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        className="h-8 w-auto gap-1 px-2.5 text-sm font-semibold"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-4",
        month: "flex w-full flex-col gap-3",
        nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex h-8 w-full items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "pointer-events-auto z-10 select-none"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "pointer-events-auto z-10 select-none"
        ),
        month_caption: "flex h-8 items-center justify-center px-9",
        dropdowns: "flex items-center justify-center gap-1.5",
        caption_label: "text-sm font-semibold select-none",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "size-9 flex-1 text-center text-[0.75rem] font-medium text-muted-foreground select-none",
        week: "mt-1 flex w-full",
        day: "group/day relative size-9 flex-1 p-0 text-center text-sm select-none",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-9 w-full rounded-lg font-normal group-data-[selected=true]/day:bg-primary group-data-[selected=true]/day:text-primary-foreground group-data-[selected=true]/day:hover:bg-primary group-data-[selected=true]/day:hover:brightness-110"
        ),
        today:
          "[&>button]:border-primary/60 [&>button]:font-semibold",
        outside: "text-muted-foreground/60",
        disabled: "text-muted-foreground/40 [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: CalendarDropdown,
        Chevron: ({ orientation, className: iconClass }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", iconClass)} />
          ) : (
            <ChevronRight className={cn("size-4", iconClass)} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
