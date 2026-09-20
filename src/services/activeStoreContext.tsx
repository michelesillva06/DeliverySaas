import React, { createContext, useContext, useState } from 'react';

interface ActiveStoreContextType {
  activeStoreId: string | null;
  setActiveStoreId: (id: string | null) => void;
  clearActiveStore: () => void;
}

const ActiveStoreContext = createContext<ActiveStoreContextType | undefined>(undefined);

const STORAGE_KEY = 'pedeai_active_store_id';

export const ActiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveStoreId = (id: string | null) => {
    if (id) {
      try {
        sessionStorage.setItem(STORAGE_KEY, id);
      } catch (err) {
        console.error('Erro ao salvar activeStoreId no sessionStorage:', err);
      }
      setActiveStoreIdState(id);
    } else {
      clearActiveStore();
    }
  };

  const clearActiveStore = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Erro ao remover activeStoreId do sessionStorage:', err);
    }
    setActiveStoreIdState(null);
  };

  return (
    <ActiveStoreContext.Provider value={{ activeStoreId, setActiveStoreId, clearActiveStore }}>
      {children}
    </ActiveStoreContext.Provider>
  );
};

export const useActiveStore = () => {
  const context = useContext(ActiveStoreContext);
  if (!context) {
    throw new Error('useActiveStore deve ser usado dentro de um ActiveStoreProvider');
  }
  return context;
};
