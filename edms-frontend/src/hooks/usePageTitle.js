import { useEffect } from "react";

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = "MemoStack";
    return () => {
      document.title = "MemoStack";
    };
  }, [title]);
}
