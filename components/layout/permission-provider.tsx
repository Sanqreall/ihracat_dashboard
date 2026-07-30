'use client';

import { createContext, useContext } from 'react';

export type ClientPermission = {
  role: 'admin' | 'manager' | 'employee' | null;
  isAdmin: boolean;
  canEdit: boolean;
};

const PermissionContext = createContext<ClientPermission>({
  role: null,
  isAdmin: false,
  canEdit: false,
});

export function PermissionProvider({
  value,
  children,
}: {
  value: ClientPermission;
  children: React.ReactNode;
}) {
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/** Client bileşenlerde yetkiyi okumak için. */
export const usePermission = () => useContext(PermissionContext);
