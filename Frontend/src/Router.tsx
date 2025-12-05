import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./pages/Layout";
import { Homepage } from "./pages/Homepage";
import { Errorpage } from "./pages/Errorpage";
import { Loginpage } from "./pages/Loginpage";
import { AccountLayout } from "./pages/AccountLayout";
import { TimeRegisterpage } from "./pages/Timeregister/TimeRegisterpage";
import { TimeRegisterLayoutpage } from "./pages/Timeregister/TimeRegisterLayoutpage";
import { TimeRegisterTemplatesPage } from "./pages/Timeregister/TimeRegistertemplatepage";
import { TimeOverveiwLayout } from "./pages/Timeoverview/TimeOverveiwLayout";
import { AdminLayout } from "./pages/Admin/AdminLayout";
import { AdminStatisticsVeiw } from "./pages/Admin/AdminStatisticsVeiw";
import { AdminTimeOverviewInfinite } from "./pages/Admin/AdminTimeOverviewInfinite";
import { UserTimeOverviewInfinite } from "./pages/Timeoverview/UserTimeOverviewInfinite";
import { AdminInvoiceMain } from "./pages/Admin/AdminInvoiceMain";
import { TimeRegisterSickpage } from "./pages/Timeregister/TimeRegisterSickpage";
import { TimeRegisterVacationpage } from "./pages/Timeregister/TimeRegisterVacationpage";
import { AccountOverviewPage } from "./pages/AccountOverviewpage";
import { RequireAuth } from "./auth/RequireAuth";
import { CreateAccount } from "./pages/CreateAccount";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

export const Router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <Errorpage />,
    children: [
      {
        path: "/",
        element: <Homepage />,
      },
      {
        path: "/login",
        element: <Loginpage />,
      },
      {
        path: "/create-account",
        element: <CreateAccount />,
      },
      {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        path: "/reset-password",
        element: <ResetPasswordPage />,
      },
    ],
  },
  {
    path: "/account",
    element: <Layout />,
    errorElement: <Errorpage />,
    children: [
      {
        path: "/account",
        element: (
          <RequireAuth>
            <AccountLayout />
          </RequireAuth>
        ),
        children: [
          {
            index: true,
            element: <AccountOverviewPage />,
          },
          {
            path: "/account/overview",
            element: <AccountOverviewPage />,
          },
          {
            path: "/account/timeregister",
            element: <TimeRegisterLayoutpage />,
            children: [
              {
                index: true,
                element: <Navigate to="labor" replace />,
              },
              {
                path: "/account/timeregister/labor",
                element: <TimeRegisterpage />,
              },
              {
                path: "/account/timeregister/sick",
                element: <TimeRegisterSickpage />,
              },
              {
                path: "/account/timeregister/vacation",
                element: <TimeRegisterVacationpage />,
              },
              {
                path: "/account/timeregister/templates",
                element: <TimeRegisterTemplatesPage />,
              },
            ],
          },
          {
            path: "/account/timeoverveiw",
            element: <TimeOverveiwLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="summary" replace />,
              },
              {
                path: "summary",
                element: <UserTimeOverviewInfinite />,
              },
            ],
          },
          {
            path: "/account/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="summary" replace /> },
              { path: "summary", element: <AdminTimeOverviewInfinite /> },
              {
                path: "statistics",
                element: <AdminStatisticsVeiw />,
              },
              {
                path: "invoice",
                element: <AdminInvoiceMain />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
