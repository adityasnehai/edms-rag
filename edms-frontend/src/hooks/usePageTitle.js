import { useEffect } from "react";

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — EDMS` : "EDMS — Company Knowledge Search";
    return () => {
      document.title = "EDMS — Company Knowledge Search";
    };
  }, [title]);
}
