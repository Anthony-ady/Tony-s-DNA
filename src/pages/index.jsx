import Layout from "./Layout.jsx";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  useLocation,
  useOutlet,
} from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { IS_EXTENSION } from "@/config/appMode";

const Login = lazy(() => import("./Login"));
const Dashboard = lazy(() => import("./Dashboard/Dashboard.jsx"));
const RealmDashboard = lazy(() => import("./Dashboard/RealmDashboard.jsx"));
const BrokerProfitability = lazy(() => import("./Dashboard/BrokerProfitability.jsx"));
const RealmProfitability = lazy(() => import("./Dashboard/RealmProfitability.jsx"));
const DSPProfitability = lazy(() => import("./Dashboard/DSPProfitability.jsx"));
const DealDashboard = lazy(() => import("./Dashboard/DealDashboard.jsx"));
const SalesDashboard = lazy(() => import("./Dashboard/SalesDashboard.jsx"));

const Company = lazy(() => import("./Company/Company"));
const CompanyDashboard = lazy(() => import("./Company/CompanyDashboard"));
const CompanyAnalytics = lazy(() => import("./Company/CompanyAnalytics"));
const EditCompany = lazy(() => import("./Company/EditCompany"));

const Site = lazy(() => import("./Site/Site"));
const SiteDashboard = lazy(() => import("./Site/SiteDashboard"));
const SiteAnalytics = lazy(() => import("./Site/SiteAnalytics"));
const EditSite = lazy(() => import("./Site/EditSite"));

const Placement = lazy(() => import("./Placement/Placement"));
const PlacementDashboard = lazy(() => import("./Placement/PlacementDashboard"));
const PlacementAnalytics = lazy(() => import("./Placement/PlacementAnalytics"));
const EditPlacement = lazy(() => import("./Placement/EditPlacement"));

const Realm = lazy(() => import("./Realm/Realm"));
const RealmAnalytics = lazy(() => import("./Realm/RealmAnalytics"));
const EditRealm = lazy(() => import("./Realm/EditRealm"));

const EditDSP = lazy(() => import("./DSP/EditDSP"));
const DSPManagement = lazy(() => import("./DSP/DSPManagement"));
const DSPDashboard = lazy(() => import("./DSP/DSPDashboard.jsx"));
const DSPAnalytics = lazy(() => import("./DSP/DSPAnalytics"));
const CreateDSP = lazy(() => import("./DSP/CreateDSP"));
const UserSyncManagement = lazy(() => import("./UserSync/UserSyncManagement"));
const EditUserSync = lazy(() => import("./UserSync/EditUserSync"));
const BlockedCreativeManagement = lazy(() => import("./BlockedCreative/BlockedCreativeManagement"));
const CreateBlockedCreative = lazy(() => import("./BlockedCreative/CreateBlockedCreative.jsx"));
const UserManagement = lazy(() => import("./User/UserManagement"));
const EditUser = lazy(() => import("./User/EditUser"));

const EditBroker = lazy(() => import("./Broker/EditBroker.jsx"));
const BrokerManagement = lazy(() => import("./Broker/BrokerManagement.jsx"));
const BrokerAnalytics = lazy(() => import("./Broker/BrokerAnalytics.jsx"));
const CreateBroker = lazy(() => import("./Broker/CreateBroker.jsx"));
const CreateUser = lazy(() => import("./User/CreateUser.jsx"));

const Deal = lazy(() => import("./Deal/Deal"));
const DealAnalytics = lazy(() => import("./Deal/DealAnalytics"));
const EditDeal = lazy(() => import("./Deal/EditDeal"));
const CreateDeal = lazy(() => import("./Deal/CreateDeal"));

const BuilderOperations = lazy(() => import("./Builder/BuilderOperations.jsx"));
const BuilderAdserver = lazy(() => import("./Builder/BuilderAdserver.jsx"));

const PAGES = {
  Dashboard,
  RealmDashboard,
  BrokerProfitability,
  RealmProfitability,
  DSPProfitability,
  DealDashboard,
  SalesDashboard,
  Company,
  CompanyDashboard,
  CompanyAnalytics,
  EditCompany,
  Site,
  SiteDashboard,
  SiteAnalytics,
  EditSite,
  Placement,
  PlacementDashboard,
  PlacementAnalytics,
  EditPlacement,
  Realm,
  RealmAnalytics,
  EditDSP,
  DSP: EditDSP,
  DSPManagement,
  DSPDashboard,
  DSPAnalytics,
  CreateDSP,
  EditBroker,
  Broker: EditBroker,
  BrokerManagement,
  BrokerAnalytics,
  CreateBroker,
  Deal,
  DealAnalytics,
  EditDeal,
  CreateDeal,
  BuilderOperations,
  BuilderAdserver,
  UserSyncManagement,
  EditUserSync,
  UserSync: EditUserSync,
  BlockedCreativeManagement,
  CreateBlockedCreative,
  UserManagement,
  EditUser,
  CreateUser,
};

function _getCurrentPage(url) {
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  let urlLastPart = url.split("/").pop();
  if (urlLastPart.includes("?")) {
    urlLastPart = urlLastPart.split("?")[0];
  }

  if (!urlLastPart) {
    return "Dashboard";
  }

  let pageName = Object.keys(PAGES).find((page) => page === urlLastPart);

  if (!pageName) {
    pageName = Object.keys(PAGES).find(
      (page) => page.toLowerCase() === urlLastPart.toLowerCase()
    );
  }

  return pageName || "Dashboard";
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(75,99,226)]" />
    </div>
  );
}

function ProtectedLayout() {
  const location = useLocation();
  const currentPage = _getCurrentPage(location.pathname);
  const outlet = useOutlet();
  const outletKey = `${location.pathname}${location.search}${location.key}`;

  return (
    <Layout currentPageName={currentPage}>
      <div key={outletKey} className="contents">
        {outlet}
      </div>
    </Layout>
  );
}

const protectedChildren = [
  { index: true, element: <Dashboard /> },
  { path: "/RealmDashboard", element: <RealmDashboard /> },
  { path: "/BrokerProfitability", element: <BrokerProfitability /> },
  { path: "/RealmProfitability", element: <RealmProfitability /> },
  { path: "/DSPProfitability", element: <DSPProfitability /> },
  { path: "/DealDashboard", element: <DealDashboard /> },
  { path: "/SalesDashboard", element: <SalesDashboard /> },
  { path: "/EditBroker", element: <EditBroker /> },
  { path: "/Broker", element: <EditBroker /> },
  { path: "/BrokerManagement", element: <BrokerManagement /> },
  { path: "/BrokerAnalytics", element: <BrokerAnalytics /> },
  { path: "/CreateBroker", element: <CreateBroker /> },
  { path: "/DSPManagement", element: <DSPManagement /> },
  { path: "/UserSyncManagement", element: <UserSyncManagement /> },
  { path: "/EditUserSync", element: <EditUserSync /> },
  { path: "/UserSync", element: <EditUserSync /> },
  { path: "/BlockedCreativeManagement", element: <BlockedCreativeManagement /> },
  { path: "/CreateBlockedCreative", element: <CreateBlockedCreative /> },
  { path: "/UserManagement", element: <UserManagement /> },
  { path: "/CreateUser", element: <CreateUser /> },
  { path: "/EditUser", element: <EditUser /> },
  { path: "/DSPDashboard", element: <DSPDashboard /> },
  { path: "/DSPAnalytics", element: <DSPAnalytics /> },
  { path: "/CreateDSP", element: <CreateDSP /> },
  { path: "/Company", element: <Company /> },
  { path: "/CompanyDashboard", element: <CompanyDashboard /> },
  { path: "/CompanyAnalytics", element: <CompanyAnalytics /> },
  { path: "/EditCompany", element: <EditCompany /> },
  { path: "/EditDSP", element: <EditDSP /> },
  { path: "/DSP", element: <EditDSP /> },
  { path: "/Deal", element: <Deal /> },
  { path: "/DealAnalytics", element: <DealAnalytics /> },
  { path: "/EditDeal", element: <EditDeal /> },
  { path: "/CreateDeal", element: <CreateDeal /> },
  { path: "/Placement", element: <Placement /> },
  { path: "/PlacementDashboard", element: <PlacementDashboard /> },
  { path: "/PlacementAnalytics", element: <PlacementAnalytics /> },
  { path: "/EditPlacement", element: <EditPlacement /> },
  { path: "/Site", element: <Site /> },
  { path: "/SiteDashboard", element: <SiteDashboard /> },
  { path: "/SiteAnalytics", element: <SiteAnalytics /> },
  { path: "/EditSite", element: <EditSite /> },
  { path: "/Realm", element: <Realm /> },
  { path: "/RealmAnalytics", element: <RealmAnalytics /> },
  { path: "/EditRealm", element: <EditRealm /> },
  { path: "/Dashboard", element: <Dashboard /> },
  { path: "/BuilderOperations", element: <BuilderOperations /> },
  { path: "/BuilderAdserver", element: <BuilderAdserver /> },
];

function createAppRouter() {
  const routes = [
    { path: "/login", element: <Login /> },
    {
      element: <ProtectedLayout />,
      children: protectedChildren,
    },
  ];

  return IS_EXTENSION ? createHashRouter(routes) : createBrowserRouter(routes);
}

export default function Pages() {
  const router = useMemo(() => createAppRouter(), []);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
