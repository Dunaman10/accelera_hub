"use client";

import * as React from "react";

interface BreadcrumbContextValue {
  dynamicLabel: string | null;
  setDynamicLabel: (label: string | null) => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  dynamicLabel: null,
  setDynamicLabel: () => {},
});

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dynamicLabel, setDynamicLabel] = React.useState<string | null>(null);

  const value = React.useMemo(
    () => ({ dynamicLabel, setDynamicLabel }),
    [dynamicLabel]
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabel(): string | null {
  return React.useContext(BreadcrumbContext).dynamicLabel;
}

export function SetBreadcrumbLabel({ label }: { label: string | null }) {
  const { setDynamicLabel } = React.useContext(BreadcrumbContext);

  React.useEffect(() => {
    setDynamicLabel(label);
    return () => setDynamicLabel(null);
  }, [label, setDynamicLabel]);

  return null;
}
