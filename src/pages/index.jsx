import Layout from "./Layout.jsx";
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Lazy loading des composants pour le code splitting
const Login = lazy(() => import("./Login"));
const Dashboard = lazy(() => import("./Dashboard/Dashboard.jsx"));
const RealmDashboard = lazy(() => import("./Dashboard/RealmDashboard.jsx"));
const BrokerProfitability = lazy(() => import("./Dashboard/BrokerProfitability.jsx"));
const RealmProfitability = lazy(() => import("./Dashboard/RealmProfitability.jsx"));
const DSPProfitability = lazy(() => import("./Dashboard/DSPProfitability.jsx"));
const DealDashboard = lazy(() => import("./Dashboard/DealDashboard.jsx"));
const SalesDashboard = lazy(() => import("./Dashboard/SalesDashboard.jsx"));

// Company pages
const Company = lazy(() => import("./Company/Company"));
const CompanyDashboard = lazy(() => import("./Company/CompanyDashboard"));
const CompanyAnalytics = lazy(() => import("./Company/CompanyAnalytics"));
const EditCompany = lazy(() => import("./Company/EditCompany"));

// Site pages
const Site = lazy(() => import("./Site/Site"));
const SiteDashboard = lazy(() => import("./Site/SiteDashboard"));
const SiteAnalytics = lazy(() => import("./Site/SiteAnalytics"));
const EditSite = lazy(() => import("./Site/EditSite"));

// Placement pages
const Placement = lazy(() => import("./Placement/Placement"));
const PlacementDashboard = lazy(() => import("./Placement/PlacementDashboard"));
const PlacementAnalytics = lazy(() => import("./Placement/PlacementAnalytics"));
const EditPlacement = lazy(() => import("./Placement/EditPlacement"));

// Realm pages
const Realm = lazy(() => import("./Realm/Realm"));
const RealmAnalytics = lazy(() => import("./Realm/RealmAnalytics"));
const EditRealm = lazy(() => import("./Realm/EditRealm"));

// DSP pages
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

// Broker pages
const EditBroker = lazy(() => import("./Broker/EditBroker.jsx"));
const BrokerManagement = lazy(() => import("./Broker/BrokerManagement.jsx"));
const BrokerAnalytics = lazy(() => import("./Broker/BrokerAnalytics.jsx"));
const CreateBroker = lazy(() => import("./Broker/CreateBroker.jsx"));
const CreateUser = lazy(() => import("./User/CreateUser.jsx"));

// Deal pages
const Deal = lazy(() => import("./Deal/Deal"));
const DealAnalytics = lazy(() => import("./Deal/DealAnalytics"));
const EditDeal = lazy(() => import("./Deal/EditDeal"));

// Builder
const BuilderOperations = lazy(() => import("./Builder/BuilderOperations.jsx"));
const BuilderAdserver = lazy(() => import("./Builder/BuilderAdserver.jsx"));

const PAGES = {
    // Dashboard
    Dashboard: Dashboard,
    RealmDashboard: RealmDashboard,
    BrokerProfitability: BrokerProfitability,
    RealmProfitability: RealmProfitability,
    DSPProfitability: DSPProfitability,
    DealDashboard: DealDashboard,
    SalesDashboard: SalesDashboard,
    
    // Company pages
    Company: Company,
    CompanyDashboard: CompanyDashboard,
    CompanyAnalytics: CompanyAnalytics,
    EditCompany: EditCompany,
    
    // Site pages
    Site: Site,
    SiteDashboard: SiteDashboard,
    SiteAnalytics: SiteAnalytics,
    EditSite: EditSite,
    
    // Placement pages
    Placement: Placement,
    PlacementDashboard: PlacementDashboard,
    PlacementAnalytics: PlacementAnalytics,
    EditPlacement: EditPlacement,
    
    // Realm pages
    Realm: Realm,
    RealmAnalytics: RealmAnalytics,
    
    // DSP pages
    EditDSP: EditDSP,
    DSP: EditDSP,
    DSPManagement: DSPManagement,
    DSPDashboard: DSPDashboard,
    DSPAnalytics: DSPAnalytics,
    CreateDSP: CreateDSP,
    
    // Broker pages
    EditBroker: EditBroker,
    Broker: EditBroker,
    BrokerManagement: BrokerManagement,
    BrokerAnalytics: BrokerAnalytics,
    CreateBroker: CreateBroker,
    
    // Deal pages
    Deal: Deal,
    DealAnalytics: DealAnalytics,
    EditDeal: EditDeal,

    BuilderOperations: BuilderOperations,
    BuilderAdserver: BuilderAdserver,

    // User Sync pages
    UserSyncManagement: UserSyncManagement,
    EditUserSync: EditUserSync,
    UserSync: EditUserSync,
    // Blocked Creatives
    BlockedCreativeManagement: BlockedCreativeManagement,
    CreateBlockedCreative: CreateBlockedCreative,
    // Users
    UserManagement: UserManagement,
    EditUser: EditUser,
    CreateUser: CreateUser,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    // If URL is just "/", return Dashboard
    if (!urlLastPart) {
        return 'Dashboard';
    }

    // Find exact match first
    let pageName = Object.keys(PAGES).find(page => page === urlLastPart);
    
    // If no exact match, try case-insensitive match
    if (!pageName) {
        pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    }

    return pageName || 'Dashboard';
}

// Composant de loading pendant le chargement des chunks
function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(75,99,226)]"></div>
        </div>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected routes */}
                <Route path="/*" element={
                    <Layout currentPageName={currentPage}>
                        <Routes>            
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/RealmDashboard" element={<RealmDashboard />} />
                            <Route path="/BrokerProfitability" element={<BrokerProfitability />} />
                            <Route path="/RealmProfitability" element={<RealmProfitability />} />
                            <Route path="/DSPProfitability" element={<DSPProfitability />} />
                            <Route path="/DealDashboard" element={<DealDashboard />} />
                            <Route path="/SalesDashboard" element={<SalesDashboard />} />
                            <Route path="/EditBroker" element={<EditBroker />} />
                            <Route path="/Broker" element={<EditBroker />} />
                            <Route path="/BrokerManagement" element={<BrokerManagement />} />
                            <Route path="/BrokerAnalytics" element={<BrokerAnalytics />} />
                            <Route path="/CreateBroker" element={<CreateBroker />} />
                            <Route path="/DSPManagement" element={<DSPManagement />} />
                            <Route path="/UserSyncManagement" element={<UserSyncManagement />} />
                            <Route path="/EditUserSync" element={<EditUserSync />} />
                            <Route path="/UserSync" element={<EditUserSync />} />
                            <Route path="/BlockedCreativeManagement" element={<BlockedCreativeManagement />} />
                            <Route path="/CreateBlockedCreative" element={<CreateBlockedCreative />} />
                            <Route path="/UserManagement" element={<UserManagement />} />
                            <Route path="/CreateUser" element={<CreateUser />} />
                            <Route path="/EditUser" element={<EditUser />} />
                            <Route path="/DSPDashboard" element={<DSPDashboard />} />
                            <Route path="/DSPAnalytics" element={<DSPAnalytics />} />
                            <Route path="/CreateDSP" element={<CreateDSP />} />
                            <Route path="/Company" element={<Company />} />
                            <Route path="/CompanyDashboard" element={<CompanyDashboard />} />
                            <Route path="/CompanyAnalytics" element={<CompanyAnalytics />} />
                            <Route path="/EditCompany" element={<EditCompany />} />
                            <Route path="/EditDSP" element={<EditDSP />} />
                            <Route path="/DSP" element={<EditDSP />} />
                            <Route path="/Deal" element={<Deal />} />
                            <Route path="/DealAnalytics" element={<DealAnalytics />} />
                            <Route path="/EditDeal" element={<EditDeal />} />
                            <Route path="/Placement" element={<Placement />} />
                            <Route path="/PlacementDashboard" element={<PlacementDashboard />} />
                            <Route path="/PlacementAnalytics" element={<PlacementAnalytics />} />
                            <Route path="/EditPlacement" element={<EditPlacement />} />
                            <Route path="/Site" element={<Site />} />
                            <Route path="/SiteDashboard" element={<SiteDashboard />} />
                            <Route path="/SiteAnalytics" element={<SiteAnalytics />} />
                            <Route path="/EditSite" element={<EditSite />} />
                            <Route path="/Realm" element={<Realm />} />
                            <Route path="/RealmAnalytics" element={<RealmAnalytics />} />
                            <Route path="/EditRealm" element={<EditRealm />} />
                            <Route path="/Dashboard" element={<Dashboard />} />
                            <Route path="/BuilderOperations" element={<BuilderOperations />} />
                            <Route path="/BuilderAdserver" element={<BuilderAdserver />} />
                        </Routes>
                    </Layout>
                } />
            </Routes>
        </Suspense>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}