import * as React from "react";

import { cn } from "@/memostack/lib/utils";

function Accordion({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex w-full flex-col", className)} {...props} />;
}

function AccordionItem({
  className,
  children,
  value: _value,
  ...props
}: React.ComponentProps<"details"> & { value?: string }) {
  return (
    <details className={cn("group/accordion-trigger", className)} {...props}>
      {children}
    </details>
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"summary">) {
  return (
    <summary
      className={cn(
        "relative flex flex-1 cursor-pointer list-none items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
        className
      )}
      {...props}
    >
      {children}
    </summary>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("overflow-hidden text-sm", className)} {...props}>
      {children}
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
