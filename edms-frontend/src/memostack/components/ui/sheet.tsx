import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/memostack/lib/utils";

const SheetContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function Sheet({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const setOpen = React.useCallback((value: boolean) => onOpenChange?.(value), [onOpenChange]);

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

function SheetTrigger({
  render,
  children,
}: {
  render?: React.ReactElement;
  children?: React.ReactNode;
}) {
  const context = React.useContext(SheetContext);
  const trigger = React.isValidElement(render) ? render : <button type="button" />;

  return React.cloneElement(trigger, {
    onClick: (event: React.MouseEvent) => {
      trigger.props.onClick?.(event);
      context?.setOpen(true);
    },
    children,
  });
}

function SheetClose({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(SheetContext);
  return (
    <button type="button" onClick={() => context?.setOpen(false)} {...props}>
      {children}
    </button>
  );
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
}: {
  className?: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const context = React.useContext(SheetContext);
  if (!context?.open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/10 backdrop-blur-xs"
        onClick={() => context.setOpen(false)}
      />
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex flex-col gap-4 border-b bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg",
          className
        )}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md hover:bg-muted"
            onClick={() => context.setOpen(false)}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-0.5 p-4", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-heading text-base font-medium text-foreground", className)} {...props} />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
