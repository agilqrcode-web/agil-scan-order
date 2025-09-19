import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape of the context data
interface PageHeaderState {
  title: string;
  backButtonHref?: string;
  headerActions?: ReactNode;
  fabAction?: ReactNode;
}

// Define the shape of the context value
interface PageHeaderContextType extends PageHeaderState {
  setHeader: (headerConfig: Partial<PageHeaderState>) => void;
  clearHeader: () => void;
}

const defaultState: PageHeaderState = {
  title: 'Dashboard',
  backButtonHref: undefined,
  headerActions: undefined,
  fabAction: undefined,
};

// Create the context
const PageHeaderContext = createContext<PageHeaderContextType | undefined>(undefined);

// Create the provider component
export const PageHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerConfig, setHeaderConfig] = useState<PageHeaderState>(defaultState);

  const setHeader = (newConfig: Partial<PageHeaderState>) => {
    // Set new config, but ensure title is never empty
    setHeaderConfig(prevConfig => ({ ...prevConfig, title: 'Dashboard', ...newConfig }));
  };

  const clearHeader = () => {
    setHeaderConfig(defaultState);
  };

  const value = { ...headerConfig, setHeader, clearHeader };

  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
};

// Create a custom hook for easy consumption of the context
export const usePageHeader = () => {
  const context = useContext(PageHeaderContext);
  if (context === undefined) {
    throw new Error('usePageHeader must be used within a PageHeaderProvider');
  }
  return context;
};
