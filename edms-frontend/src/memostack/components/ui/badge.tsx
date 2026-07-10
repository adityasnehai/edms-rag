import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/memostack/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border-border text-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    render?: React.ReactElement;
  }) {
  const mergedClassName = cn(badgeVariants({ variant }), className);

  if (React.isValidElement(render)) {
    return React.cloneElement(render, {
      ...props,
      ...render.props,
      className: cn(mergedClassName, render.props.className),
      children,
    });
  }

  return (
    <span className={mergedClassName} {...props}>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
