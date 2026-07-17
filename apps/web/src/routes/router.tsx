import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AppealsRegistryPage } from "@/pages/AppealsRegistryPage";
import { AppealDetailPage } from "@/pages/AppealDetailPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { UsersPage } from "@/pages/UsersPage";
import { DirectoriesPage } from "@/pages/DirectoriesPage";
import { AuditPage } from "@/pages/AuditPage";
import { RequireAuth } from "./RequireAuth";
import { RequirePermission } from "./RequirePermission";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/change-password", element: <ChangePasswordPage /> },
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/appeals", element: <AppealsRegistryPage /> },
          { path: "/appeals/:id", element: <AppealDetailPage /> },
          { path: "/kanban", element: <Navigate to="/appeals?view=kanban" replace /> },
          { path: "/reports", element: <ReportsPage /> },
          {
            element: <RequirePermission permission="user.manage" />,
            children: [
              { path: "/users", element: <UsersPage /> },
              { path: "/directories", element: <DirectoriesPage /> },
            ],
          },
          {
            element: <RequirePermission permission="audit.read" />,
            children: [{ path: "/audit", element: <AuditPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
