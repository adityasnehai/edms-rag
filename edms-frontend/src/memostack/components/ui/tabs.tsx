import * as React from "react";

import { cn } from "@/memostack/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("inline-flex w-fit items-center rounded-lg bg-muted p-1", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground", className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-2", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
