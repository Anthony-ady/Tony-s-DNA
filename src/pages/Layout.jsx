import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Building2, Target, Menu, X, Zap, HandCoins, Network, LogOut, User, Globe, Plus, Clock, FileText, Megaphone, Gavel, Users, DollarSign, Monitor, ChevronRight, ChevronLeft, ChevronDown, Crown, Search, Layers, ArrowLeftRight, UserCog, Settings, Hammer, Server, History, Activity, Loader2, RefreshCw, Link as LinkIcon, Link2, Globe2, TrendingUp, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { clearCache, cachedFetch } from '@/utils/apiCache';
import { API_ENDPOINTS } from '@/config/api';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import { IS_EXTENSION } from '@/config/appMode';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Tailwind lg breakpoint = 1024px - use to avoid rendering children twice (mobile + desktop)
const useIsMobileLg = () => {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
    useEffect(() => {
        const mql = window.matchMedia('(max-width: 1023px)');
        const handler = () => setIsMobile(mql.matches);
        mql.addEventListener('change', handler);
        setIsMobile(mql.matches);
        return () => mql.removeEventListener('change', handler);
    }, []);
    return isMobile;
};

export default function Layout({ children, currentPageName }) {
    const isMobileView = useIsMobileLg();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userData, setUserData] = useState(null);
    const [openSubMenu, setOpenSubMenu] = useState(null);
    const [isSubMenuClosing, setIsSubMenuClosing] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    
    // Install global unauthorized interceptor and redirect handler
    useEffect(() => {
        authService.installUnauthorizedInterceptor?.();

        const handleUnauthorized = () => {
            if (location.pathname.toLowerCase() !== '/login') {
                navigate('/Login');
            }
        };

        window.addEventListener('auth-unauthorized', handleUnauthorized);
        return () => {
            window.removeEventListener('auth-unauthorized', handleUnauthorized);
        };
    }, [navigate, location.pathname]);
    

    
    // Compute header titles based on current page
    const getHeaderTitles = () => {
        let mainTitle = '';
        let subTitle = null;

        const dashboardPages = ['Dashboard', 'RealmDashboard', 'CompanyDashboard', 'SiteDashboard', 'PlacementDashboard', 'DSPDashboard', 'DealDashboard'];
        const supplyPages = ['Broker', 'Realm', 'Company', 'Site', 'Placement'];
        const demandPages = ['DSPManagement', 'DSP', 'EditDSP', 'UserSyncManagement', 'EditUserSync', 'UserSync', 'BlockedCreativeManagement'];
        const builderPages = ['BuilderOperations', 'BuilderAdserver'];
        
        // Profitability pages
        const profitabilityPages = ['BrokerProfitability', 'RealmProfitability', 'DSPProfitability'];

        // Check if we're in Profitability context
        if (profitabilityPages.includes(currentPageName)) {
            mainTitle = 'Profitability';
            // Find the sub-item name
            const item = profitabilitySubItems.find(si => 
                si.children && si.children.some(c => c.path === currentPageName)
            );
            if (item) {
                const child = item.children.find(c => c.path === currentPageName);
                if (child) subTitle = child.name;
            }
        } else if (currentPageName === 'Profitability') {
            mainTitle = 'Profitability';
        } else if (dashboardPages.includes(currentPageName)) {
            mainTitle = 'Monitoring';
            const item = (typeof dashboardSubItems !== 'undefined') ? dashboardSubItems.find(si => si.path === currentPageName) : null;
            if (item) subTitle = item.name;
        } else if (currentPageName === 'Broker' || currentPageName === 'EditBroker') {
            mainTitle = 'Supply';
            subTitle = 'Edit Broker';
        } else if (supplyPages.includes(currentPageName)) {
            mainTitle = 'Supply';
            const item = (typeof supplySubItems !== 'undefined') ? supplySubItems.find(si => si.path === currentPageName) : null;
            if (item) subTitle = item.name;
        } else if (currentPageName === 'DSP' || currentPageName === 'EditDSP') {
            mainTitle = 'Demand';
            subTitle = 'Edit DSP';
        } else if (demandPages.includes(currentPageName)) {
            mainTitle = 'Demand';
            const item = (typeof demandSubItems !== 'undefined') ? demandSubItems.find(si => si.path === currentPageName) : null;
            if (item) subTitle = item.name;
        } else if (builderPages.includes(currentPageName)) {
            mainTitle = 'Builder';
            const item = builderSubItems.find(si => si.path === currentPageName);
            if (item) subTitle = item.name;
        } else if (currentPageName === 'Deal' || currentPageName === 'DealAnalytics' || currentPageName === 'EditDeal' || currentPageName === 'CreateDeal') {
            mainTitle = 'Deals';
        } else if (currentPageName === 'UserManagement') {
            mainTitle = 'Users';
            subTitle = 'User Management';
        } else if (currentPageName === 'EditUser') {
            mainTitle = 'Users';
            subTitle = 'Edit User';
        } else {
            mainTitle = currentPageName || '';
        }

        return { mainTitle, subTitle };
    };
    

    
    // Clear localStorage API cache and refetch (dashboard + analytics listen for druidCacheCleared)
    const handleRefresh = () => {
        clearCache();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('druidCacheCleared'));
        }
        if (typeof window !== 'undefined' && window.refreshDashboard) {
            window.refreshDashboard();
        } else if (typeof window !== 'undefined' && !isAnalyticsPage()) {
            window.location.reload();
        }
    };
    
    // Check if current page is a dashboard page
    const isDashboardPage = () => {
        const dashboardPages = ['Dashboard', 'RealmDashboard', 'BrokerProfitability', 'RealmProfitability', 'DSPProfitability', 'CompanyDashboard', 'SiteDashboard', 'PlacementDashboard', 'DSPDashboard', 'DealDashboard', 'SalesDashboard'];
        return dashboardPages.includes(currentPageName);
    };
    
    // Pages where Realm filter should be displayed
    const showRealmFilter = useCallback(() => {
        const pathname = location.pathname;
        const allowedPaths = [
            '/DealDashboard',
            '/PlacementDashboard',
            '/SiteDashboard',
            '/CompanyDashboard',
            '/SalesDashboard',
            '/Deal',
            '/Company',
            '/Site',
            '/Placement'
        ];
        return allowedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
    }, [location.pathname]);

    // Pages where Time Range selector should be displayed (dashboard menu + analytics pages)
    const showTimeRange = () => {
        const pathname = location.pathname;
        const allowedPaths = [
            // Dashboard menu pages
            '/Dashboard',
            '/RealmDashboard',
            '/BrokerProfitability',
            '/RealmProfitability',
            '/DSPProfitability',
            '/DSPDashboard',
            '/DealDashboard',
            '/CompanyDashboard',
            '/SiteDashboard',
            '/PlacementDashboard',
            '/SalesDashboard',
            // Analytics pages
            '/RealmAnalytics',
            '/CompanyAnalytics',
            '/SiteAnalytics',
            '/PlacementAnalytics',
            '/BrokerAnalytics',
            '/DSPAnalytics',
            '/DealAnalytics'
        ];
        return allowedPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
    };
    
    // Check if current page is an Analytics page
    const isAnalyticsPage = () => {
        const pathname = location.pathname;
        const analyticsPaths = [
            '/RealmAnalytics',
            '/CompanyAnalytics',
            '/SiteAnalytics',
            '/PlacementAnalytics',
            '/BrokerAnalytics',
            '/DSPAnalytics',
            '/DealAnalytics'
        ];
        return analyticsPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
    };
    
    // Check if current page is a Dashboard page (for search display)
    const isDashboardPageForSearch = () => {
        const dashboardPages = ['RealmDashboard', 'CompanyDashboard', 'SiteDashboard', 'PlacementDashboard', 'DSPDashboard', 'DealDashboard'];
        return dashboardPages.includes(currentPageName);
    };
    
    // Monitoring search state - shared via window event (not stored in localStorage)
    const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
    
    // Dispatch search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('dashboardSearchChanged', { detail: dashboardSearchTerm });
        window.dispatchEvent(event);
    }, [dashboardSearchTerm]);
    
    // Clear search term when navigating away from Monitoring pages
    useEffect(() => {
        const dashboardPages = ['RealmDashboard', 'BrokerProfitability', 'RealmProfitability', 'DSPProfitability', 'CompanyDashboard', 'SiteDashboard', 'PlacementDashboard', 'DSPDashboard', 'DealDashboard'];
        if (!dashboardPages.includes(currentPageName)) {
            setDashboardSearchTerm('');
        }
    }, [currentPageName]);
    
    // DSPManagement search state - shared via window event (not stored in localStorage)
    const [dspManagementSearchTerm, setDspManagementSearchTerm] = useState('');
    
    // Dispatch DSPManagement search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('dspManagementSearchChanged', { detail: dspManagementSearchTerm });
        window.dispatchEvent(event);
    }, [dspManagementSearchTerm]);
    
    // Clear DSPManagement search term when navigating away from DSPManagement page
    useEffect(() => {
        if (currentPageName !== 'DSPManagement') {
            setDspManagementSearchTerm('');
        }
    }, [currentPageName]);
    
    // Supply pages search states - shared via window events (not stored in localStorage)
    const [brokerManagementSearchTerm, setBrokerManagementSearchTerm] = useState('');
    const [realmPageSearchTerm, setRealmPageSearchTerm] = useState('');
    const [companyPageSearchTerm, setCompanyPageSearchTerm] = useState('');
    const [siteSearchTerm, setSiteSearchTerm] = useState('');
    const [placementSearchTerm, setPlacementSearchTerm] = useState('');
    const [dealSearchTerm, setDealSearchTerm] = useState('');
    
    // Dispatch BrokerManagement search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('brokerManagementSearchChanged', { detail: brokerManagementSearchTerm });
        window.dispatchEvent(event);
    }, [brokerManagementSearchTerm]);
    
    // Dispatch Realm page search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('realmSearchChanged', { detail: realmPageSearchTerm });
        window.dispatchEvent(event);
    }, [realmPageSearchTerm]);
    
    // Dispatch Company page search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('companySearchChanged', { detail: companyPageSearchTerm });
        window.dispatchEvent(event);
    }, [companyPageSearchTerm]);
    
    // Dispatch Site search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('siteSearchChanged', { detail: siteSearchTerm });
        window.dispatchEvent(event);
    }, [siteSearchTerm]);
    
    // Dispatch Placement search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('placementSearchChanged', { detail: placementSearchTerm });
        window.dispatchEvent(event);
    }, [placementSearchTerm]);
    
    // Dispatch Deal search term change event when it updates
    useEffect(() => {
        const event = new CustomEvent('dealSearchChanged', { detail: dealSearchTerm });
        window.dispatchEvent(event);
    }, [dealSearchTerm]);

    // UserSyncManagement search state
    const [userSyncSearchTerm, setUserSyncSearchTerm] = useState('');

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('userSyncSearchChanged', { detail: userSyncSearchTerm }));
    }, [userSyncSearchTerm]);

    useEffect(() => {
        if (currentPageName !== 'UserSyncManagement') {
            setUserSyncSearchTerm('');
        }
    }, [currentPageName]);

    // BlockedCreativeManagement search state
    const [blockedCreativeSearchTerm, setBlockedCreativeSearchTerm] = useState('');
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('blockedCreativeSearchChanged', { detail: blockedCreativeSearchTerm }));
    }, [blockedCreativeSearchTerm]);
    useEffect(() => {
        if (currentPageName !== 'BlockedCreativeManagement') {
            setBlockedCreativeSearchTerm('');
        }
    }, [currentPageName]);
    useEffect(() => {
        const handler = (e) => setBlockedCreativeSearchTerm(e.detail ?? '');
        window.addEventListener('blockedCreativeSearchSet', handler);
        return () => window.removeEventListener('blockedCreativeSearchSet', handler);
    }, []);

    // UserManagement search state
    const [userManagementSearchTerm, setUserManagementSearchTerm] = useState('');
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('userManagementSearchChanged', { detail: userManagementSearchTerm }));
    }, [userManagementSearchTerm]);
    useEffect(() => {
        if (currentPageName !== 'UserManagement') {
            setUserManagementSearchTerm('');
        }
    }, [currentPageName]);
    
    // Clear Supply pages search terms when navigating away
    useEffect(() => {
        if (currentPageName !== 'BrokerManagement') {
            setBrokerManagementSearchTerm('');
        }
        if (currentPageName !== 'Realm') {
            setRealmPageSearchTerm('');
        }
        if (currentPageName !== 'Company') {
            setCompanyPageSearchTerm('');
        }
        if (currentPageName !== 'Site') {
            setSiteSearchTerm('');
        }
        if (currentPageName !== 'Placement') {
            setPlacementSearchTerm('');
        }
        if (currentPageName !== 'Deal') {
            setDealSearchTerm('');
        }
    }, [currentPageName]);
    
    // Time range selector state - stored in localStorage to share with analytics pages
    const [selectedTimeRange, setSelectedTimeRange] = useState(() => {
        return localStorage.getItem('selected-time-range') || '7d';
    });
    
    // Save time range to localStorage when it changes and dispatch event
    useEffect(() => {
        localStorage.setItem('selected-time-range', selectedTimeRange);
        // Dispatch event for immediate update
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('timeRangeChanged', { detail: selectedTimeRange }));
        }
    }, [selectedTimeRange]);
    
    // Monitoring view mode state - stored in localStorage
    const [dashboardViewMode, setDashboardViewMode] = useState(() => {
        return localStorage.getItem('dashboard-view-mode') || 'daily';
    });
    
    // Save dashboard view mode to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('dashboard-view-mode', dashboardViewMode);
    }, [dashboardViewMode]);
    
    // Analytics view mode state - stored in localStorage
    const [analyticsViewMode, setAnalyticsViewMode] = useState(() => {
        return localStorage.getItem('analytics-view-mode') || 'daily';
    });
    
    // Save analytics view mode to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('analytics-view-mode', analyticsViewMode);
    }, [analyticsViewMode]);
    
    // User rank and power user info
    const [userRank, setUserRank] = useState(null);
    const [isPowerUser, setIsPowerUser] = useState(false);
    
    // Realm filter states
    const [realms, setRealms] = useState([]);
    const [realmSearchTerm, setRealmSearchTerm] = useState('');
    const [realmPopoverOpen, setRealmPopoverOpen] = useState(false);
    const [selectedRealmId, setSelectedRealmId] = useState(() => {
        return localStorage.getItem('selected-realm-id') || '';
    });
    
    // Company filter states (for SiteDashboard and PlacementDashboard)
    const [companies, setCompanies] = useState([]);
    const [companySearchTerm, setCompanySearchTerm] = useState('');
    const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
        return localStorage.getItem('selected-company-id') || '';
    });

    // User filter states (for SalesDashboard only)
    const [users, setUsers] = useState([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userPopoverOpen, setUserPopoverOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(() => {
        return localStorage.getItem('selected-user-id') || '';
    });

    // Check authentication status on component mount
    useEffect(() => {
        const checkAuth = () => {
            const authStatus = authService.getAuthStatus();
            setIsAuthenticated(authStatus);
            
            if (authStatus) {
                setUserData(authService.getUserData());
            } else {
                // Only redirect if we're not already on the login page
                if (window.location.pathname !== '/login') {
                    navigate('/login');
                }
            }
        };

        checkAuth();
    }, [navigate]);

    // Ensure session data is loaded before rendering user button
    useEffect(() => {
        let cancelled = false;
        const loadSession = async () => {
            if (!isAuthenticated || userData) return;
            const sessionData = await authService.getSessionData(true);
            if (cancelled) return;
            const nextUser = sessionData?.CurrentUser || authService.getUserData();
            setUserData(nextUser || null);
        };

        loadSession();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, userData]);

    // Do not auto-open sub-menus - user needs to click to open them

    /**
     * Handles user logout
     */
    const handleLogout = () => {
        authService.logout();
        setIsAuthenticated(false);
        setUserData(null);
        navigate('/login');
    };

    /**
     * Toggle sub-menu visibility
     */
    const toggleSubMenu = (menuName) => {
        if (openSubMenu === menuName) {
            // Closing current menu
            handleCloseSubMenu();
        } else {
            // Opening new menu or switching
            setIsSubMenuClosing(false);
            setOpenSubMenu(menuName);
        }
    };

    /**
     * Handle sub-menu closing with animation
     */
    const handleCloseSubMenu = () => {
        setIsSubMenuClosing(true);
        setTimeout(() => {
            setOpenSubMenu(null);
            setIsSubMenuClosing(false);
        }, 500); // Match animation duration
    };
    
    // Fetch companies for a specific realm
    const fetchCompaniesForRealm = async (realmId) => {
        const token = authService.getToken();
        if (!token) return;
        
        try {
            const payload = {
                Filters: realmId ? [{ Field: "Realm_uid", Operator: "match", Value: realmId }] : [],
                From: 0,
                Order: [{ Field: "Name", Operator: "asc" }],
                Size: 1000
            };
            
            const response = await fetch(API_ENDPOINTS.COMPANIES_SEARCH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ayl-auth-token': token
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.Data) {
                    const visibleCompanies = data.Data.filter(company => company.Visibility !== -1);
                    setCompanies(visibleCompanies);
                    
                    const savedCompanyId = localStorage.getItem('selected-company-id');
                    if (savedCompanyId && !visibleCompanies.some(company => company.Uid === savedCompanyId)) {
                        localStorage.removeItem('selected-company-id');
                        setSelectedCompanyId('');
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching companies:', err);
        }
    };

    // Fetch realms data and set default realm from session
    // Only fetch realms if we're on a page that needs the realm filter
    useEffect(() => {
        // Only fetch realms if we're on a page that displays the realm filter
        if (!showRealmFilter()) {
            return;
        }

        if (!realms.length) {
            const fetchRealms = async () => {
                const token = authService.getToken();
                if (!token) return;

                try {
                    const payload = {
                        Filters: [],
                        From: 0,
                        Order: [{ Field: "Name", Operator: "asc" }],
                        Size: 1000
                    };

                    const response = await cachedFetch(API_ENDPOINTS.REALMS_SEARCH, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-ayl-auth-token': token
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.Data) {
                            const visibleRealms = data.Data.filter(realm => realm.Visibility !== -1);
                            setRealms(visibleRealms);
                            
                            // Fetch current realm from session API
                            const sessionData = await authService.getSessionData();
                            if (sessionData) {
                                const currentRealmUid = sessionData?.CurrentRealm?.Uid;
                                
                                // Check if we need to set a default realm
                                const savedRealmId = localStorage.getItem('selected-realm-id');
                                if (!savedRealmId && currentRealmUid && visibleRealms.some(realm => realm.Uid === currentRealmUid)) {
                                    // Set current realm as default
                                    localStorage.setItem('selected-realm-id', currentRealmUid);
                                    setSelectedRealmId(currentRealmUid);
                                    window.dispatchEvent(new Event('realmChanged'));
                                } else if (savedRealmId && !visibleRealms.some(realm => realm.Uid === savedRealmId)) {
                                    // Previously saved realm is no longer visible
                                    localStorage.removeItem('selected-realm-id');
                                    setSelectedRealmId('');
                                }
                                
                                // Set user rank and power user status
                                if (sessionData?.CurrentUser) {
                                    setUserRank(sessionData.CurrentUser.Rank);
                                    setIsPowerUser(sessionData.CurrentUser.PowerUser === true);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching realms:', err);
                }
            };

            fetchRealms();
        }
    }, [location.pathname, realms.length, showRealmFilter]);

    // Fetch companies for Site, Placement, SiteDashboard and PlacementDashboard
    useEffect(() => {
        if (currentPageName === 'Site' || currentPageName === 'Placement' || 
            currentPageName === 'SiteDashboard' || currentPageName === 'PlacementDashboard') {
            // Fetch companies for the current realm
            const selectedRealmId = localStorage.getItem('selected-realm-id') || '';
            fetchCompaniesForRealm(selectedRealmId);
        }
    }, [currentPageName, selectedRealmId]);

    // Fetch users for SalesDashboard
    const fetchUsersForRealm = async (realmId) => {
        const token = authService.getToken();
        if (!token || !realmId) return;
        
        try {
            const payload = {
                Filters: [{ Field: "Realm_uid", Operator: "match", Value: realmId }],
                From: 0,
                Order: [{ Field: "LastSignInAt", Operator: "desc" }],
                Size: 500
            };
            
            const response = await cachedFetch(API_ENDPOINTS.USERS_SEARCH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ayl-auth-token': token
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.Data) {
                    setUsers(data.Data);
                    
                    const savedUserId = localStorage.getItem('selected-user-id');
                    if (savedUserId && !data.Data.some(user => user.Uid === savedUserId)) {
                        localStorage.removeItem('selected-user-id');
                        setSelectedUserId('');
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    // Fetch users for SalesDashboard when realm changes
    useEffect(() => {
        if (currentPageName === 'SalesDashboard') {
            const selectedRealmId = localStorage.getItem('selected-realm-id') || '';
            if (selectedRealmId) {
                fetchUsersForRealm(selectedRealmId);
            } else {
                setUsers([]);
            }
        }
    }, [currentPageName, selectedRealmId]);

    // Helper function to truncate long names
    const truncateName = (name, maxLength = 16) => {
        if (!name || name.length <= maxLength) return name;
        return name.substring(0, maxLength) + '...';
    };

    // Helper function to get user initials
    const getUserInitials = () => {
        if (!userData) return 'U';
        if (userData.FirstName && userData.LastName) {
            return `${userData.FirstName[0]}${userData.LastName[0]}`.toUpperCase();
        }
        if (userData.Email) {
            return userData.Email[0].toUpperCase();
        }
        return 'U';
    };

    // Get selected realm name
    const selectedRealmName = selectedRealmId
        ? (realms.find(realm => realm.Uid === selectedRealmId)?.Name || 'Select Realm')
        : 'All Realms';

    // Filter realms based on search term
    const filteredRealms = [
        { Uid: '', Name: 'All Realms', Visibility: 0 },
        ...realms
    ].filter(realm =>
        realm.Name.toLowerCase().includes(realmSearchTerm.toLowerCase())
    );
    
    // Get selected company name
    const selectedCompanyName = selectedCompanyId
        ? (companies.find(company => company.Uid === selectedCompanyId)?.Name || 'Select Company')
        : 'All Companies';

    // Filter companies based on search term
    const filteredCompanies = [
        { Uid: '', Name: 'All Companies', Visibility: 0 },
        ...companies
    ].filter(company =>
        company.Name.toLowerCase().includes(companySearchTerm.toLowerCase())
    );

    // Get selected user name
    const selectedUserName = selectedUserId
        ? (() => {
            const user = users.find(u => u.Uid === selectedUserId);
            if (user) {
                const firstName = user.FirstName || '';
                const lastName = user.LastName || '';
                return `${firstName} ${lastName}`.trim() || 'Select User';
            }
            return 'Select User';
        })()
        : 'All Users';

    // Filter users based on search term
    const filteredUsers = [
        { Uid: '', FirstName: '', LastName: 'All Users' },
        ...users
    ].filter(user => {
        const firstName = user.FirstName || '';
        const lastName = user.LastName || '';
        const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
        return fullName.includes(userSearchTerm.toLowerCase());
    });

    // Render user badges (rank + power user) with pretty styles
    const renderUserBadges = () => {
        const rankIsSuperadmin = typeof userRank === 'string' && userRank.toUpperCase() === 'SUPERADMIN';
        return (
            <div className="flex flex-col items-start gap-1">
                {userRank && (
                    <Badge
                        className={
                            `text-xs ${rankIsSuperadmin
                                ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm'
                                : 'border-slate-300 text-slate-700 bg-white'}
                            `
                        }
                        variant={rankIsSuperadmin ? undefined : 'outline'}
                    >
                        {rankIsSuperadmin && <Crown className="w-3 h-3 mr-1 opacity-90" />}
                        {userRank}
                    </Badge>
                )}
                {isPowerUser && (
                    <Badge className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm">
                        <Zap className="w-3 h-3 mr-1" />
                        Power User
                    </Badge>
                )}
            </div>
        );
    };

    // Save realm selection
    const saveRealmSelection = (realmId) => {
        localStorage.setItem('selected-realm-id', realmId);
        setSelectedRealmId(realmId);
        
        // Reset company selection when realm changes
        localStorage.removeItem('selected-company-id');
        setSelectedCompanyId('');
        
        // Reset user selection when realm changes (for SalesDashboard)
        if (currentPageName === 'SalesDashboard') {
            localStorage.removeItem('selected-user-id');
            setSelectedUserId('');
        }
        
        // Reload companies for the new realm if on Site, Placement, SiteDashboard or PlacementDashboard
        if (currentPageName === 'Site' || currentPageName === 'Placement' || 
            currentPageName === 'SiteDashboard' || currentPageName === 'PlacementDashboard') {
            fetchCompaniesForRealm(realmId);
        }
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('realmChanged'));
    };

    /** Realm list (Manager): clear header search + bust list cache + reload */
    const resetSupplyRealmList = () => {
        setRealmPageSearchTerm('');
        window.dispatchEvent(new CustomEvent('supplyRealmListReset'));
    };

    /**
     * Company list (Manager): clear header search + realm filter + bust cache + reload.
     * Prepare event keeps Company fetch aligned before realmChanged runs (sync ref).
     */
    const resetSupplyCompanyList = () => {
        window.dispatchEvent(new CustomEvent('companyListPrepareReset'));
        setCompanyPageSearchTerm('');
        saveRealmSelection('');
        window.dispatchEvent(new CustomEvent('supplyCompanyListReset'));
    };

    /** Site list (Manager): clear search + realm + company filters, bust cache, reload */
    const resetSupplySiteList = () => {
        window.dispatchEvent(new CustomEvent('siteListPrepareReset'));
        setSiteSearchTerm('');
        saveRealmSelection('');
        window.dispatchEvent(new CustomEvent('supplySiteListReset'));
    };

    /** Placement list (Manager): same as Site */
    const resetSupplyPlacementList = () => {
        window.dispatchEvent(new CustomEvent('placementListPrepareReset'));
        setPlacementSearchTerm('');
        saveRealmSelection('');
        window.dispatchEvent(new CustomEvent('supplyPlacementListReset'));
    };

    const isManagerSupplyListPage =
        currentPageName === 'Company' || currentPageName === 'Site' || currentPageName === 'Placement';

    const managerSupplyListRefreshAction =
        currentPageName === 'Company'
            ? resetSupplyCompanyList
            : currentPageName === 'Site'
              ? resetSupplySiteList
              : resetSupplyPlacementList;

    const managerSupplyListRefreshTitle =
        currentPageName === 'Company'
            ? 'Refresh — clears realm filter and search'
            : 'Refresh — clears realm, company filter and search';
    
    // Note: timeRangeChanged is already dispatched in the useEffect above (lines 335-341)
    // when selectedTimeRange changes - no need for a duplicate dispatch here.
    
    // Save company selection
    const saveCompanySelection = (companyId) => {
        localStorage.setItem('selected-company-id', companyId);
        setSelectedCompanyId(companyId);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('companyChanged'));
    };

    // Save user selection
    const saveUserSelection = (userId) => {
        localStorage.setItem('selected-user-id', userId);
        setSelectedUserId(userId);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('userChanged'));
    };

    // Main navigation items inspired by the image
    const mainNavItems = [
        { name: 'Monitoring', path: null, icon: <Clock className="w-5 h-5" /> },
        { name: 'Profitability', path: null, icon: <TrendingUp className="w-5 h-5" /> },
        { name: 'Manager', path: null, icon: <Settings className="w-5 h-5" /> },
        { name: 'Builder', path: null, icon: <Hammer className="w-5 h-5" /> },
        { name: 'Users', path: 'UserManagement', icon: <Users className="w-5 h-5" /> },
    ];

    // Sub-menu items for Monitoring section
    const dashboardSubItems = [
        {
            name: 'Supply',
            icon: <Layers className="w-4 h-4" />,
            children: [
        { name: 'Overview', path: 'Dashboard', icon: <Globe className="w-4 h-4" /> },
        { name: 'Realm', path: 'RealmDashboard', icon: <Globe2 className="w-4 h-4" /> },
        { name: 'Company', path: 'CompanyDashboard', icon: <Building2 className="w-4 h-4" /> },
        { name: 'Site', path: 'SiteDashboard', icon: <LinkIcon className="w-4 h-4" /> },
        { name: 'Placement', path: 'PlacementDashboard', icon: <Target className="w-4 h-4" /> },
            ]
        },
        {
            name: 'Demand',
            icon: <Network className="w-4 h-4" />,
            children: [
        { name: 'DSP', path: 'DSPDashboard', icon: <Monitor className="w-4 h-4" /> },
            ]
        },
        {
            name: 'Trading',
            icon: <ArrowLeftRight className="w-4 h-4" />,
            children: [
        { name: 'Deal', path: 'DealDashboard', icon: <Gavel className="w-4 h-4" /> },
            ]
        },
        {
            name: 'Sales',
            icon: <DollarSign className="w-4 h-4" />,
            children: [
        { name: 'Dashboard', path: 'SalesDashboard', icon: <TrendingUp className="w-4 h-4" /> },
            ]
        },
    ];

    // Sub-menu items for Profitability section
    const profitabilitySubItems = [
        {
            name: 'Supply',
            icon: <Layers className="w-4 h-4" />,
            children: [
                { name: 'Broker', path: 'BrokerProfitability', icon: <Network className="w-4 h-4" /> },
                { name: 'Realm', path: 'RealmProfitability', icon: <Globe2 className="w-4 h-4" /> },
            ]
        },
        {
            name: 'Demand',
            icon: <Network className="w-4 h-4" />,
            children: [
                { name: 'DSP', path: 'DSPProfitability', icon: <Monitor className="w-4 h-4" /> },
            ]
        },
    ];

    // Sub-menu items for Supply section
    const supplySubItems = [
        { name: 'Broker', path: 'BrokerManagement', icon: <Network className="w-4 h-4" /> },
        { name: 'Realm', path: 'Realm', icon: <Globe2 className="w-4 h-4" /> },
        { name: 'Company', path: 'Company', icon: <Building2 className="w-4 h-4" /> },
        { name: 'Site', path: 'Site', icon: <LinkIcon className="w-4 h-4" /> },
        { name: 'Placement', path: 'Placement', icon: <Target className="w-4 h-4" /> },
    ];

    // Sub-menu items for Demand section (like in the image)
    const demandSubItems = [
        { name: 'DSP Management', path: 'DSPManagement', icon: <Network className="w-4 h-4" /> },
        { name: 'User Sync', path: 'UserSyncManagement', icon: <Link2 className="w-4 h-4" /> },
        { name: 'Blocked Creatives', path: 'BlockedCreativeManagement', icon: <ShieldOff className="w-4 h-4" /> },
    ];

    const builderSubItems = [
        {
            name: 'Historical Operations',
            path: 'BuilderOperations',
            icon: <History className="w-4 h-4" />,
            tooltip: 'Programmatic KPIs, up to three months back, no same-day data.',
        },
        {
            name: 'Adserver Live',
            path: 'BuilderAdserver',
            icon: <Activity className="w-4 h-4" />,
            tooltip: 'Adserver metrics with near real-time data (up to tomorrow).',
        },
    ];

    const managerSubItems = [
        {
            name: 'Supply',
            icon: <Layers className="w-4 h-4" />,
            children: [
                { name: 'Broker', path: 'BrokerManagement', icon: <Network className="w-4 h-4" /> },
                { name: 'Realm', path: 'Realm', icon: <Globe2 className="w-4 h-4" /> },
                { name: 'Company', path: 'Company', icon: <Building2 className="w-4 h-4" /> },
                { name: 'Site', path: 'Site', icon: <LinkIcon className="w-4 h-4" /> },
                { name: 'Placement', path: 'Placement', icon: <Target className="w-4 h-4" /> },
            ],
        },
        {
            name: 'Demand',
            icon: <Network className="w-4 h-4" />,
            children: [
                { name: 'DSP', path: 'DSPManagement', icon: <Monitor className="w-4 h-4" /> },
                { name: 'User Sync', path: 'UserSyncManagement', icon: <Link2 className="w-4 h-4" /> },
                { name: 'Blocked Creatives', path: 'BlockedCreativeManagement', icon: <ShieldOff className="w-4 h-4" /> },
            ]
        },
        {
            name: 'Trading',
            icon: <ArrowLeftRight className="w-4 h-4" />,
            children: [
                { name: 'Deal', path: 'Deal', icon: <Gavel className="w-4 h-4" /> },
            ]
        },
    ];

    /** Extension: hide Profitability / Builder / Users */
    const navMainItems = IS_EXTENSION
        ? mainNavItems.filter((item) => !['Profitability', 'Builder', 'Users'].includes(item.name))
        : mainNavItems;

    const navDashboardSubItems = dashboardSubItems;

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Left Sidebar - Compact vertical icons */}
            <div className="hidden lg:flex flex-col w-20 bg-white border-r border-slate-200 items-center fixed left-0 top-0 bottom-0 z-30">
                {/* User Info - Clickable to show dropdown */}
                <div className="w-full border-b border-slate-200 flex items-center justify-center" style={{ height: '70px' }}>
                    {userData && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgb(75,99,226)] text-white font-semibold text-sm hover:bg-[rgb(40,62,173)] transition-colors cursor-pointer">
                                    {getUserInitials()}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 ml-4">
                                <div className="px-2 py-1.5">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
                                        <User className="w-3.5 h-3.5" />
                                        <span>{userData.FirstName && userData.LastName ? `${userData.FirstName} ${userData.LastName}` : (userData.Email || 'User')}</span>
                                    </div>
                                    {renderUserBadges()}
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-red-600 focus:text-red-600 cursor-pointer"
                                >
                                    <LogOut className="w-3.5 h-3.5 mr-2" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Desktop Navigation - Vertical icon menu */}
                <nav className="flex-1 w-full py-4 flex flex-col items-center">
                    {navMainItems.map((item) => (
                        <div key={item.name} className="w-full flex items-center justify-center">
                            {item.path ? (
                                <Link
                                    to={createPageUrl(item.path)}
                                    className={`flex flex-col items-center justify-center w-full py-5 rounded-lg transition-colors group ${
                                        currentPageName === item.path
                                            ? 'text-[rgb(75,99,226)]'
                                            : 'text-slate-500 hover:bg-[rgb(40,62,173)] hover:text-white'
                                    }`}
                                    onClick={handleCloseSubMenu}
                                >
                                    <div className={`${currentPageName === item.path ? 'text-[rgb(75,99,226)]' : 'text-slate-600 group-hover:text-white'}`}>
                                        {item.icon}
                                    </div>
                                    <span className="text-xs mt-1 font-medium">{item.name}</span>
                                </Link>
                            ) : (
                                <div 
                                    className={`flex flex-col items-center justify-center w-full py-5 rounded-lg transition-colors cursor-pointer group ${
                                        (item.name === 'Monitoring' && ((currentPageName === 'Dashboard' || currentPageName === 'RealmDashboard' || currentPageName === 'BrokerDashboard' || currentPageName === 'DSPDashboard' || currentPageName === 'DealDashboard' || currentPageName === 'SalesDashboard') || openSubMenu === 'Monitoring')) ||
                                        (item.name === 'Profitability' && currentPageName === 'Profitability') ||
                                        (item.name === 'Supply' && ((currentPageName === 'Broker' || currentPageName === 'EditBroker' ||  currentPageName === 'Realm' || currentPageName === 'Company' || currentPageName === 'Site' || currentPageName === 'Placement') || openSubMenu === 'Supply')) ||
                                        (item.name === 'Demand' && (currentPageName === 'DSPManagement' || currentPageName === 'EditDSP' || currentPageName === 'DSP' || currentPageName === 'BlockedCreativeManagement' || openSubMenu === 'Demand')) ||
                                        (item.name === 'Manager' && openSubMenu === 'Manager') ||
                                        (item.name === 'Builder' && ((currentPageName === 'BuilderOperations' || currentPageName === 'BuilderAdserver') || openSubMenu === 'Builder'))
                                            ? 'text-[rgb(75,99,226)]'
                                            : 'text-slate-500 hover:bg-[rgb(40,62,173)] hover:text-white'
                                    }`}
                                    onClick={() => {
                                        toggleSubMenu(item.name);
                                    }}
                                >
                                    <div className={`${
                                        (item.name === 'Monitoring' && ((currentPageName === 'Dashboard' || currentPageName === 'RealmDashboard' || currentPageName === 'BrokerDashboard' || currentPageName === 'DSPDashboard' || currentPageName === 'DealDashboard' || currentPageName === 'SalesDashboard') || openSubMenu === 'Monitoring')) ||
                                        (item.name === 'Profitability' && currentPageName === 'Profitability') ||
                                        (item.name === 'Supply' && ((currentPageName === 'Broker' || currentPageName === 'EditBroker' ||  currentPageName === 'Realm' || currentPageName === 'Company' || currentPageName === 'Site' || currentPageName === 'Placement') || openSubMenu === 'Supply')) ||
                                        (item.name === 'Demand' && (currentPageName === 'DSPManagement' || currentPageName === 'EditDSP' || currentPageName === 'DSP' || currentPageName === 'BlockedCreativeManagement' || openSubMenu === 'Demand')) ||
                                        (item.name === 'Manager' && openSubMenu === 'Manager') ||
                                        (item.name === 'Builder' && ((currentPageName === 'BuilderOperations' || currentPageName === 'BuilderAdserver') || openSubMenu === 'Builder'))
                                            ? 'text-[rgb(75,99,226)]' 
                                            : 'text-slate-600 group-hover:text-white'
                                    }`}>
                                        {item.icon}
                                    </div>
                                    <span className="text-xs mt-1 font-medium">{item.name}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
                
                {/* Logout button at bottom */}
                <div className="w-full border-t border-slate-200 flex items-center justify-center" style={{ height: '80px' }}>
                    <button
                        onClick={handleLogout}
                        className="flex flex-col items-center justify-center w-full py-3 rounded-lg transition-colors text-slate-500 hover:text-red-600 hover:bg-red-50"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-xs mt-1 font-medium">Logout</span>
                    </button>
                </div>
            </div>
            
            {/* Right Sub-menu Panel */}
            {openSubMenu && (
                <>
                    {/* Backdrop */}
                    {!isSubMenuClosing && (
                        <div 
                            className="hidden lg:block fixed inset-0 bg-black/10 z-10 animate-in fade-in duration-300"
                            onClick={handleCloseSubMenu}
                        />
                    )}
                    {/* Sidebar */}
                    <div className={`hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed left-20 top-0 bottom-0 z-20 ${
                        isSubMenuClosing
                            ? 'animate-out slide-out-to-left duration-500 ease-out'
                            : 'animate-in slide-in-from-left duration-500 ease-out'
                    }`}>
                    {/* Sub-menu header */}
                    <div className="px-6 border-b border-slate-200 flex items-center justify-between" style={{ height: '70px' }}>
                        <h2 className="text-base font-semibold text-slate-900">
                            {openSubMenu === 'Monitoring' && 'Monitoring'}
                            {openSubMenu === 'Profitability' && 'Profitability'}
                            {openSubMenu === 'Supply' && 'Supply'}
                            {openSubMenu === 'Demand' && 'Demand'}
                            {openSubMenu === 'Manager' && 'Manager'}
                            {openSubMenu === 'Builder' && 'Builder'}
                        </h2>
                        <button
                            onClick={handleCloseSubMenu}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Sub-menu items */}
                    <nav className="flex-1 p-4 space-y-3">
                        {openSubMenu === 'Monitoring' && navDashboardSubItems.map((subItem) => (
                            subItem.children ? (
                                <div key={subItem.name} className="space-y-2">
                                    <div className={cn('flex items-center gap-2 px-3', TAILWIND_CLASSES.formSectionLabel)}>
                                        {subItem.icon}
                                        <span>{subItem.name}</span>
                                    </div>
                                    <div className="space-y-1 pl-4">
                                        {subItem.children.map((child) => (
                                            <Link
                                                key={child.path}
                                                to={createPageUrl(child.path)}
                                                onClick={() => setOpenSubMenu(null)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                    currentPageName === child.path
                                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                                }`}
                                            >
                                                <div className={`${currentPageName === child.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                                    {child.icon}
                                                </div>
                                                <span>{child.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                        <Link
                                            key={subItem.path}
                                            to={createPageUrl(subItem.path)}
                                onClick={() => setOpenSubMenu(null)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                currentPageName === subItem.path
                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                <div className={`${currentPageName === subItem.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                            {subItem.icon}
                                </div>
                                <span>{subItem.name}</span>
                                        </Link>
                            )
                                    ))}
                        
                        {openSubMenu === 'Profitability' && profitabilitySubItems.map((subItem) => (
                            subItem.children ? (
                                <div key={subItem.name} className="space-y-2">
                                    <div className={cn('flex items-center gap-2 px-3', TAILWIND_CLASSES.formSectionLabel)}>
                                        {subItem.icon}
                                        <span>{subItem.name}</span>
                                    </div>
                                    <div className="space-y-1 pl-4">
                                        {subItem.children.map((child) => (
                                            <Link
                                                key={child.path}
                                                to={createPageUrl(child.path)}
                                                onClick={() => setOpenSubMenu(null)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                    currentPageName === child.path
                                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                                }`}
                                            >
                                                <div className={`${currentPageName === child.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                                    {child.icon}
                                                </div>
                                                <span>{child.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                        <Link
                                            key={subItem.path}
                                            to={createPageUrl(subItem.path)}
                                            onClick={() => setOpenSubMenu(null)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                currentPageName === subItem.path
                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                <div className={`${currentPageName === subItem.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                            {subItem.icon}
                                </div>
                                <span>{subItem.name}</span>
                                        </Link>
                            )
                                    ))}
                            
                        {openSubMenu === 'Supply' && supplySubItems.map((subItem) => {
                            if (subItem.children) {
                                return (
                                <div key={subItem.name} className="space-y-2">
                                    <div className={cn('flex items-center gap-2 px-3', TAILWIND_CLASSES.formSectionLabel)}>
                                        {subItem.icon}
                                        <span>{subItem.name}</span>
                                    </div>
                                    <div className="space-y-1 pl-4">
                                        {subItem.children.map((child) => (
                                            <Link
                                                key={child.path}
                                                to={createPageUrl(child.path)}
                                                onClick={() => setOpenSubMenu(null)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                    currentPageName === child.path
                                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                                }`}
                                            >
                                                <div className={`${currentPageName === child.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                                    {child.icon}
                                                </div>
                                                <span>{child.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                                );
                            }
                            const isSupplySubActive =
                                currentPageName === subItem.path ||
                                (subItem.path === 'BrokerManagement' &&
                                    (currentPageName === 'EditBroker' || currentPageName === 'Broker'));
                            return (
                                            <Link
                                                key={subItem.path}
                                                to={createPageUrl(subItem.path)}
                                    onClick={() => setOpenSubMenu(null)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                    isSupplySubActive
                                            ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                            : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                                }`}
                                            >
                                    <div className={`${isSupplySubActive ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                                {subItem.icon}
                                    </div>
                                    <span>{subItem.name}</span>
                                            </Link>
                                        );
                                    })}
                            
                        {openSubMenu === 'Demand' && demandSubItems.map((subItem) => {
                            const isDemandSubActive =
                                currentPageName === subItem.path ||
                                (subItem.path === 'DSPManagement' &&
                                    (currentPageName === 'EditDSP' || currentPageName === 'DSP'));
                            return (
                                        <Link
                                            key={subItem.path}
                                            to={createPageUrl(subItem.path)}
                                onClick={() => setOpenSubMenu(null)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                isDemandSubActive
                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                <div className={`${isDemandSubActive ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                            {subItem.icon}
                                </div>
                                <span>{subItem.name}</span>
                                                                        </Link>
                            );
                            })}

                        {openSubMenu === 'Builder' && builderSubItems.map((subItem) => {
                            const content = (
                                <div className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                    currentPageName === subItem.path
                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                }`}>
                                    <div className={`${currentPageName === subItem.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                        {subItem.icon}
                                    </div>
                                    <span>{subItem.name}</span>
                                </div>
                            );

                            return (
                                <Link
                                    key={subItem.path}
                                    to={createPageUrl(subItem.path)}
                                    onClick={() => setOpenSubMenu(null)}
                                    className="block"
                                    title={subItem.tooltip}
                                >
                                    {content}
                                </Link>
                            );
                        })}
    
                        {openSubMenu === 'Manager' && managerSubItems.map((item) => (
                            item.children ? (
                                <div key={item.name} className="space-y-2">
                                    <div className={cn('flex items-center gap-2 px-3', TAILWIND_CLASSES.formSectionLabel)}>
                                        {item.icon}
                                        <span>{item.name}</span>
                                    </div>
                                    <div className="space-y-1 pl-4">
                                        {item.children.map((child) => (
                                            <Link
                                                key={child.path}
                                                to={createPageUrl(child.path)}
                                                onClick={() => setOpenSubMenu(null)}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                                    currentPageName === child.path
                                                        ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                                        : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                                }`}
                                            >
                                                <div className={`${currentPageName === child.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                                    {child.icon}
                                                </div>
                                                <span>{child.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    key={item.name}
                                    to={createPageUrl(item.path)}
                                    onClick={() => setOpenSubMenu(null)}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group ${
                                        currentPageName === item.path
                                            ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)]'
                                            : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                                    }`}
                                >
                                    <div className={`${currentPageName === item.path ? 'text-[rgb(75,99,226)]' : 'text-slate-400 group-hover:text-white'}`}>
                                        {item.icon}
                                    </div>
                                    <span>{item.name}</span>
                                </Link>
                            )
                            ))}
                        </nav>
                    </div>
                </>
            )}

            {/* Mobile Header */}
            <div className="lg:hidden flex-1">
                <header className="bg-white shadow-sm border-b border-slate-200">
                    <div className="px-3 py-2">
                        <div className="flex justify-between items-center mb-2">
                        {/* Mobile Menu Button and Back Button */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="h-8 w-8 p-0 hover:bg-slate-100 transition-colors"
                                title="Go back"
                            >
                                <ChevronLeft className="w-6 h-6 back-arrow-animate" style={{ color: 'rgb(75, 99, 226)', strokeWidth: 2.5 }} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </Button>
                        </div>
                        {/* User info on right */}
                        <div className="flex items-center gap-2">
                            {userData && (
                                <div className="flex items-center gap-1 text-xs text-slate-600">
                                    <User className="w-3 h-3" />
                                    <span className="hidden sm:inline">{userData.FirstName && userData.LastName ? `${userData.FirstName} ${userData.LastName}` : (userData.Email || 'User')}</span>
                                    {renderUserBadges()}
                                </div>
                            )}
                        </div>
                        </div>
                        {/* Search for Dashboard pages - Mobile */}
                        {isDashboardPageForSearch() && (
                            <div className="mb-2">
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Search..."
                                        value={dashboardSearchTerm}
                                        onChange={(e) => setDashboardSearchTerm(e.target.value)}
                                        className="w-full pl-10 h-9 text-sm"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                            </div>
                        )}
                        
                        {/* Search for DSPManagement page - Mobile */}
                        {currentPageName === 'DSPManagement' && (
                            <div className="mb-2">
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Search DSPs..."
                                        value={dspManagementSearchTerm}
                                        onChange={(e) => setDspManagementSearchTerm(e.target.value)}
                                        className="w-full pl-10 h-9 text-sm"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                            </div>
                        )}
                        {/* Search for Supply pages - Mobile */}
                        {currentPageName === 'BrokerManagement' && (
                            <div className="mb-2">
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Search Brokers..."
                                        value={brokerManagementSearchTerm}
                                        onChange={(e) => setBrokerManagementSearchTerm(e.target.value)}
                                        className="w-full pl-10 h-9 text-sm"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                            </div>
                        )}
                        {currentPageName === 'Realm' && (
                            <div className="mb-2 flex items-center gap-2">
                                <div className="relative flex-1 min-w-0">
                                    <Input
                                        type="text"
                                        placeholder="Search Realms..."
                                        value={realmPageSearchTerm}
                                        onChange={(e) => setRealmPageSearchTerm(e.target.value)}
                                        className="w-full pl-10 h-9 text-sm"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title="Clear search and reload list"
                                    aria-label="Clear search and reload list"
                                    onClick={resetSupplyRealmList}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        {isManagerSupplyListPage && (
                            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/95 p-2.5 shadow-sm ring-1 ring-slate-200/60">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        List filters
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 shrink-0 gap-1 px-2 text-[11px] font-medium border-slate-200 bg-white text-[rgb(75,99,226)] hover:bg-[rgb(75,99,226)] hover:text-white hover:border-[rgb(75,99,226)]"
                                        title={managerSupplyListRefreshTitle}
                                        aria-label={managerSupplyListRefreshTitle}
                                        onClick={managerSupplyListRefreshAction}
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Refresh
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder={
                                            currentPageName === 'Company'
                                                ? 'Search companies…'
                                                : currentPageName === 'Site'
                                                  ? 'Search sites…'
                                                  : 'Search placements…'
                                        }
                                        value={
                                            currentPageName === 'Company'
                                                ? companyPageSearchTerm
                                                : currentPageName === 'Site'
                                                  ? siteSearchTerm
                                                  : placementSearchTerm
                                        }
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (currentPageName === 'Company') setCompanyPageSearchTerm(v);
                                            else if (currentPageName === 'Site') setSiteSearchTerm(v);
                                            else setPlacementSearchTerm(v);
                                        }}
                                        className="w-full pl-10 h-9 text-sm bg-white"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                            </div>
                        )}
                        {currentPageName === 'Deal' && (
                            <div className="mb-2">
                                <div className="relative">
                                    <Input
                                        type="text"
                                        placeholder="Search Deals..."
                                        value={dealSearchTerm}
                                        onChange={(e) => setDealSearchTerm(e.target.value)}
                                        className="w-full pl-10 h-9 text-sm"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                            </div>
                        )}
                        {/* Dashboard Controls - Mobile */}
                        {(currentPageName === 'Dashboard'
                          || currentPageName === 'DashboardCopy'
                          || currentPageName === 'RealmDashboard'
                          || currentPageName === 'DealDashboard'
                          || currentPageName === 'SalesDashboard'
                          || currentPageName === 'CompanyDashboard'
                          || currentPageName === 'SiteDashboard'
                          || currentPageName === 'PlacementDashboard'
                          || currentPageName === 'DSPDashboard') && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm flex-1 justify-center">
                                        <button
                                            onClick={() => setDashboardViewMode(dashboardViewMode === 'hourly' ? 'daily' : 'hourly')}
                                            className={`px-2 py-1 text-xs font-medium transition-colors rounded-md flex-1 ${
                                                dashboardViewMode === 'hourly'
                                                    ? 'bg-[rgb(75,99,226)] text-white'
                                                    : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                            Real-time
                                        </button>
                        </div>
                        </div>
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm w-full">
                                    {['30d', '20d', '14d', '7d', '5d'].map((range) => (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setSelectedTimeRange(range);
                                                // If in hourly mode, switch to daily when selecting a time range
                                                if (dashboardViewMode === 'hourly') {
                                                    setDashboardViewMode('daily');
                                                }
                                            }}
                                            className={`px-2 py-1 text-xs font-medium transition-colors rounded-md flex-1 ${
                                                dashboardViewMode === 'daily' && selectedTimeRange === range
                                                    ? 'bg-[rgb(75,99,226)] text-white'
                                                    : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Analytics Controls - Mobile */}
                        {isAnalyticsPage() && (
                            <div className="space-y-2">
                                <Button
                                    onClick={handleRefresh}
                                    variant="outline"
                                    className="w-full h-8 text-xs font-medium"
                                    type="button"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                    Refresh
                                </Button>
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm w-full">
                                    <button
                                        onClick={() => setAnalyticsViewMode(analyticsViewMode === 'hourly' ? 'daily' : 'hourly')}
                                        className={`px-2 py-1 text-xs font-medium transition-colors rounded-md flex-1 ${
                                            analyticsViewMode === 'hourly'
                                                ? 'bg-[rgb(75,99,226)] text-white'
                                                : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                        }`}
                                    >
                                        Real-time
                                    </button>
                                </div>
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm w-full">
                                    {['30d', '20d', '14d', '7d', '5d'].map((range) => (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setSelectedTimeRange(range);
                                                if (analyticsViewMode === 'hourly') {
                                                    setAnalyticsViewMode('daily');
                                                }
                                            }}
                                            className={`px-2 py-1 text-xs font-medium transition-colors rounded-md flex-1 ${
                                                selectedTimeRange === range
                                                    ? 'bg-[rgb(75,99,226)] text-white'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Time Range Only - Mobile */}
                        {showTimeRange() && !isAnalyticsPage() && currentPageName !== 'Dashboard' && (
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm w-full">
                                {['30d', '20d', '14d', '7d', '5d'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setSelectedTimeRange(range)}
                                        className={`px-2 py-1 text-xs font-medium transition-colors rounded-md flex-1 ${
                                            selectedTimeRange === range
                                                ? 'bg-[rgb(75,99,226)] text-white'
                                                : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </header>
                
                {/* Mobile Navigation Overlay */}
                        {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        {/* Backdrop */}
                        <div 
                            className="absolute inset-0 bg-black/50"
                            onClick={() => setIsMobileMenuOpen(false)}
                        ></div>
                        
                        {/* Menu drawer */}
                        <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl overflow-y-auto">
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center gap-2 mb-4">
                                    {userData && (
                                                                                <button className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgb(75,99,226)] text-white font-semibold text-sm">
                                    {getUserInitials()}
                                </button>
                                    )}
                                    <div className="flex-1">
                                        {userData && (
                                            <div className="text-sm font-semibold text-slate-900">
                                                {userData.FirstName && userData.LastName ? `${userData.FirstName} ${userData.LastName}` : (userData.Email || 'User')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <nav className="p-4 space-y-1">
                                    {navMainItems.map((item) => (
                                        <div key={item.name}>
                                            {item.path ? (
                                                <Link
                                                    to={createPageUrl(item.path)}
                                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        currentPageName === item.path
                                                            ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)] border-l-4 border-[rgb(75,99,226)]'
                                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                    }`}
                                                    onClick={() => {
                                                        setIsMobileMenuOpen(false);
                                                        setOpenSubMenu(null);
                                                    }}
                                                >
                                                    <div className={`${currentPageName === item.path ? 'text-[rgb(75,99,226)]' : 'text-slate-500'}`}>
                                                        {item.icon}
                                                    </div>
                                                    <span className="font-medium">{item.name}</span>
                                                </Link>
                                            ) : (
                                                <div 
                                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        (item.name === 'Monitoring' && ((currentPageName === 'Dashboard' || currentPageName === 'RealmDashboard' || currentPageName === 'BrokerDashboard' || currentPageName === 'DSPDashboard' || currentPageName === 'DealDashboard' || currentPageName === 'SalesDashboard') || openSubMenu === 'Monitoring')) ||
                                                        (item.name === 'Profitability' && openSubMenu === 'Profitability') ||
                                                        (item.name === 'Supply' && ((currentPageName === 'Broker' || currentPageName === 'EditBroker' ||  currentPageName === 'Realm' || currentPageName === 'Company' || currentPageName === 'Site' || currentPageName === 'Placement') || openSubMenu === 'Supply')) ||
                                                        (item.name === 'Demand' && (currentPageName === 'DSPManagement' || currentPageName === 'EditDSP' || currentPageName === 'DSP' || currentPageName === 'BlockedCreativeManagement' || openSubMenu === 'Demand')) ||
                                                        (item.name === 'Manager' && openSubMenu === 'Manager') ||
                                                        (item.name === 'Builder' && ((currentPageName === 'BuilderOperations' || currentPageName === 'BuilderAdserver') || openSubMenu === 'Builder'))
                                                            ? 'bg-[rgb(75,99,226)]/10 text-[rgb(75,99,226)] border-l-4 border-[rgb(75,99,226)]'
                                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                                                    }`}
                                                    onClick={() => {
                                        toggleSubMenu(item.name);
                                    }}
                                                >
                                                    <div className={`${                                                        (item.name === 'Monitoring' && ((currentPageName === 'Dashboard' || currentPageName === 'RealmDashboard' || currentPageName === 'BrokerDashboard' || currentPageName === 'DSPDashboard' || currentPageName === 'DealDashboard' || currentPageName === 'SalesDashboard') || openSubMenu === 'Monitoring')) ||
                                                        (item.name === 'Profitability' && openSubMenu === 'Profitability') ||
                                                        (item.name === 'Supply' && ((currentPageName === 'Broker' || currentPageName === 'EditBroker' ||  currentPageName === 'Realm' || currentPageName === 'Company' || currentPageName === 'Site' || currentPageName === 'Placement') || openSubMenu === 'Supply')) ||
                                                        (item.name === 'Demand' && (currentPageName === 'DSPManagement' || currentPageName === 'EditDSP' || currentPageName === 'DSP' || currentPageName === 'BlockedCreativeManagement' || openSubMenu === 'Demand')) ||
                                                        (item.name === 'Manager' && openSubMenu === 'Manager') ||
                                                        (item.name === 'Builder' && ((currentPageName === 'BuilderOperations' || currentPageName === 'BuilderAdserver') || openSubMenu === 'Builder'))
                                                            ? 'text-[rgb(75,99,226)]' 
                                                            : 'text-slate-500'}`}>
                                                        {item.icon}
                                                    </div>
                                                    <span className="font-medium">{item.name}</span>
                                                </div>
                                            )}
                                            
                                            {/* Show sub-menu for Monitoring */}
                                            {item.name === 'Monitoring' && ((currentPageName === 'Dashboard' || currentPageName === 'RealmDashboard' || currentPageName === 'BrokerDashboard' || currentPageName === 'DSPDashboard' || currentPageName === 'DealDashboard' || currentPageName === 'SalesDashboard') || openSubMenu === 'Monitoring') && (
                                                <div className="ml-8 mt-2 space-y-2 animate-in slide-in-from-left duration-300 ease-out">
                                                    {navDashboardSubItems.map((subItem) =>
                                                        subItem.children ? (
                                                            <div key={subItem.name} className="space-y-1">
                                                                <div className={cn('flex items-center gap-2 px-3 py-1', TAILWIND_CLASSES.formSectionLabel)}>
                                                                    {subItem.icon}
                                                                    <span>{subItem.name}</span>
                                                                </div>
                                                                <div className="space-y-1 pl-4">
                                                                    {subItem.children.map((child) => (
                                                                        <Link
                                                                            key={child.path}
                                                                            to={createPageUrl(child.path)}
                                                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                                currentPageName === child.path
                                                                                    ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                                            }`}
                                                                            onClick={() => setIsMobileMenuOpen(false)}
                                                                        >
                                                                            {child.icon}
                                                                            <span className="flex-1">{child.name}</span>
                                                                            {currentPageName === child.path && (
                                                                                <ChevronRight className="w-3 h-3 text-[rgb(75,99,226)]" />
                                                                            )}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            subItem.path && (
                                                        <Link
                                                            key={subItem.path}
                                                            to={createPageUrl(subItem.path)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                currentPageName === subItem.path
                                                                    ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                            }`}
                                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                        >
                                                            {subItem.icon}
                                                            <span className="flex-1">{subItem.name}</span>
                                                            {currentPageName === subItem.path && (
                                                                <ChevronRight className="w-3 h-3 text-[rgb(75,99,226)]" />
                                                            )}
                                                        </Link>
                                                            )
                                                        )
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Show sub-menu for Profitability */}
                                            {item.name === 'Profitability' && openSubMenu === 'Profitability' && (
                                                <div className="ml-8 mt-2 space-y-2 animate-in slide-in-from-left duration-300 ease-out">
                                                    {profitabilitySubItems.map((subItem) =>
                                                        subItem.children ? (
                                                            <div key={subItem.name} className="space-y-1">
                                                                <div className={cn('flex items-center gap-2 px-3 py-1', TAILWIND_CLASSES.formSectionLabel)}>
                                                                    {subItem.icon}
                                                                    <span>{subItem.name}</span>
                                                                </div>
                                                                <div className="space-y-1 pl-4">
                                                                    {subItem.children.map((child) => (
                                                                        <Link
                                                                            key={child.path}
                                                                            to={createPageUrl(child.path)}
                                                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                                currentPageName === child.path
                                                                                    ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                                            }`}
                                                                            onClick={() => {
                                                                                setIsMobileMenuOpen(false);
                                                                                setOpenSubMenu(null);
                                                                            }}
                                                                        >
                                                                            {child.icon}
                                                                            <span className="flex-1">{child.name}</span>
                                                                            {currentPageName === child.path && (
                                                                                <ChevronRight className="w-3 h-3 text-[rgb(75,99,226)]" />
                                                                            )}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            subItem.path && (
                                                        <Link
                                                            key={subItem.path}
                                                            to={createPageUrl(subItem.path)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                currentPageName === subItem.path
                                                                    ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                            }`}
                                                                    onClick={() => {
                                                                        setIsMobileMenuOpen(false);
                                                                        setOpenSubMenu(null);
                                                                    }}
                                                        >
                                                            {subItem.icon}
                                                            <span className="flex-1">{subItem.name}</span>
                                                            {currentPageName === subItem.path && (
                                                                <ChevronRight className="w-3 h-3 text-[rgb(75,99,226)]" />
                                                            )}
                                                        </Link>
                                                            )
                                                        )
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Show sub-menu for Supply */}
                                            {item.name === 'Supply' && ((currentPageName === 'Broker' || currentPageName === 'EditBroker' ||  currentPageName === 'Realm' || currentPageName === 'Company' || currentPageName === 'Site' || currentPageName === 'Placement') || openSubMenu === 'Supply') && (
                                                <div className="ml-8 mt-2 space-y-1 animate-in slide-in-from-left duration-300 ease-out">
                                                    {supplySubItems.map((subItem) => {
                                                        const isSupplySubActive =
                                                            currentPageName === subItem.path ||
                                                            (subItem.path === 'BrokerManagement' &&
                                                                (currentPageName === 'EditBroker' || currentPageName === 'Broker'));
                                                        return subItem.path ? (
                                                        <Link
                                                            key={subItem.path}
                                                            to={createPageUrl(subItem.path)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                isSupplySubActive
                                                                    ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                            }`}
                                                            onClick={() => {
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            {subItem.icon}
                                                            <span>{subItem.name}</span>
                                                        </Link>
                                                        ) : (
                                                            <div
                                                                key={subItem.name}
                                                                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-slate-300 cursor-not-allowed"
                                                            >
                                                                {subItem.icon}
                                                                <span>{subItem.name}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            
                                            {/* Show sub-menu for Demand */}
                                            {item.name === 'Demand' && (currentPageName === 'DSPManagement' || currentPageName === 'EditDSP' || currentPageName === 'DSP' || currentPageName === 'BlockedCreativeManagement' || openSubMenu === 'Demand') && (
                                                <div className="ml-8 mt-2 space-y-1 animate-in slide-in-from-left duration-300 ease-out">
                                                    {demandSubItems.map((subItem) => {
                                                        const isDemandSubActive =
                                                            currentPageName === subItem.path ||
                                                            (subItem.path === 'DSPManagement' &&
                                                                (currentPageName === 'EditDSP' || currentPageName === 'DSP'));
                                                        return (
                                                        <Link
                                                            key={subItem.path}
                                                            to={createPageUrl(subItem.path)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                isDemandSubActive
                                                                    ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                            }`}
                                                            onClick={() => {
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            {subItem.icon}
                                                            <span>{subItem.name}</span>
                                                        </Link>
                                                    );
                                                    })}
                                                </div>
                                            )}
                                            
                                            {/* Show sub-menu for Manager */}
                                            {item.name === 'Manager' && openSubMenu === 'Manager' && (
                                                <div className="ml-8 mt-2 space-y-2 animate-in slide-in-from-left duration-300 ease-out">
                                                    {managerSubItems.map((subGroup) => (
                                                        <div key={subGroup.name} className="space-y-1">
                                                            <div className={cn('flex items-center gap-2 px-3 py-1', TAILWIND_CLASSES.formSectionLabel)}>
                                                                {subGroup.icon}
                                                                <span>{subGroup.name}</span>
                                                            </div>
                                                            <div className="space-y-1 pl-4">
                                                                {subGroup.children.map((child) => (
                                                                    <Link
                                                                        key={child.path}
                                                                        to={createPageUrl(child.path)}
                                                                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                                                            currentPageName === child.path
                                                                                ? 'bg-[rgb(75,99,226)]/20 text-[rgb(75,99,226)]'
                                                                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                                        }`}
                                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                                    >
                                                                        {child.icon}
                                                                        <span className="flex-1">{child.name}</span>
                                                                        {currentPageName === child.path && (
                                                                            <ChevronRight className="w-3 h-3 text-[rgb(75,99,226)]" />
                                                                        )}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    
                                    {/* Mobile Logout Button */}
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            handleLogout();
                                        }}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-red-600 hover:bg-red-50 hover:text-red-700 w-full mt-4"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        <div>
                                            <div>Logout</div>
                                            <div className="text-xs text-red-500">Sign out of your account</div>
                                        </div>
                                    </button>
                                </nav>
                        </div>
                            </div>
                        )}
                
                {/* Main Content Mobile - only render when mobile to avoid duplicate API calls */}
                {isMobileView && (
                <main className="flex-1 overflow-y-auto w-full">
                    {children}
                </main>
                )}
            </div>

                {/* Main Content Desktop - only render when desktop to avoid duplicate API calls */}
            {!isMobileView && (
            <div className={`flex flex-1 flex-col h-screen overflow-hidden transition-all duration-200 ${openSubMenu ? 'ml-[276px]' : 'ml-20'}`}>
                {/* Desktop Header */}
                <header className={`bg-white border-b border-slate-200 fixed top-0 right-0 z-10 transition-all duration-200 ${openSubMenu ? 'left-[276px]' : 'left-20'}`} style={{ height: '70px' }}>
                    <div className="px-6 h-full flex items-center gap-4">
                        {/* Back Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(-1)}
                            className="h-8 w-8 p-0 hover:bg-slate-100 transition-colors"
                            title="Go back"
                        >
                            <ChevronLeft className="w-6 h-6 back-arrow-animate" style={{ color: 'rgb(75, 99, 226)', strokeWidth: 2.5 }} />
                        </Button>
                        {/* Left side: Page title + Realm/Company filters */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                            {(() => {
                                const { mainTitle, subTitle } = getHeaderTitles();
                                return (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">{mainTitle}</span>
                                        {subTitle && (
                                            <>
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                                <span className="text-sm text-slate-600">{subTitle}</span>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                            {/* Manager supply lists: unified filter bar (Realm ± Company + Refresh) */}
                            {showRealmFilter() && isManagerSupplyListPage && (
                                <div
                                    className={cn(
                                        'flex flex-nowrap items-center gap-x-3 gap-y-0 rounded-lg border border-slate-200 bg-slate-50/95 px-3 py-2 shadow-sm',
                                        'ring-1 ring-slate-200/60 max-w-[min(640px,46vw)] overflow-x-auto',
                                        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                                    )}
                                    role="group"
                                    aria-label="List filters"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap shrink-0">
                                            Realm
                                        </span>
                                        <Popover open={realmPopoverOpen} onOpenChange={setRealmPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    role="combobox"
                                                    aria-expanded={realmPopoverOpen}
                                                    className="w-[min(180px,26vw)] justify-between h-8 text-xs bg-white border-slate-200"
                                                >
                                                    <span className="text-xs truncate">{truncateName(selectedRealmName, 18)}</span>
                                                    <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[180px] p-0">
                                                <Command>
                                                    <CommandInput
                                                        placeholder="Search realm..."
                                                        value={realmSearchTerm}
                                                        onValueChange={setRealmSearchTerm}
                                                        className="h-9"
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>No realm found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {filteredRealms.map((realm) => (
                                                                <CommandItem
                                                                    key={realm.Uid}
                                                                    value={realm.Name}
                                                                    onSelect={() => {
                                                                        saveRealmSelection(realm.Uid);
                                                                        setRealmPopoverOpen(false);
                                                                        setRealmSearchTerm('');
                                                                    }}
                                                                    className="text-xs"
                                                                >
                                                                    {realm.Name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {(currentPageName === 'Site' || currentPageName === 'Placement') && (
                                        <>
                                            <div className="hidden sm:block h-6 w-px bg-slate-200 shrink-0" aria-hidden />
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap shrink-0">
                                                    Company
                                                </span>
                                                <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            role="combobox"
                                                            aria-expanded={companyPopoverOpen}
                                                            className="w-[min(180px,26vw)] justify-between h-8 text-xs bg-white border-slate-200"
                                                        >
                                                            <span className="text-xs truncate">{truncateName(selectedCompanyName, 18)}</span>
                                                            <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[180px] p-0">
                                                        <Command>
                                                            <CommandInput
                                                                placeholder="Search company..."
                                                                value={companySearchTerm}
                                                                onValueChange={setCompanySearchTerm}
                                                                className="h-9"
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>No company found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {filteredCompanies.map((company) => (
                                                                        <CommandItem
                                                                            key={company.Uid}
                                                                            value={company.Name}
                                                                            onSelect={() => {
                                                                                saveCompanySelection(company.Uid);
                                                                                setCompanyPopoverOpen(false);
                                                                                setCompanySearchTerm('');
                                                                            }}
                                                                            className="text-xs"
                                                                        >
                                                                            {company.Name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </>
                                    )}

                                    <div className="hidden sm:block h-6 w-px bg-slate-200 shrink-0 sm:ml-0" aria-hidden />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 shrink-0 gap-1.5 px-3 text-xs font-medium border-slate-200 bg-white text-[rgb(75,99,226)] hover:bg-[rgb(75,99,226)] hover:text-white hover:border-[rgb(75,99,226)]"
                                        title={managerSupplyListRefreshTitle}
                                        aria-label={managerSupplyListRefreshTitle}
                                        onClick={managerSupplyListRefreshAction}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Refresh
                                    </Button>
                                </div>
                            )}

                            {/* Realm only (Deal, dashboards, Site/Placement dashboards, etc.) */}
                            {showRealmFilter() && !isManagerSupplyListPage && (
                                <div className="flex items-center gap-2">
                                    <Label>Realm:</Label>
                                    <Popover open={realmPopoverOpen} onOpenChange={setRealmPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                role="combobox"
                                                aria-expanded={realmPopoverOpen}
                                                className="w-[180px] justify-between h-8 text-xs"
                                            >
                                                <span className="text-xs">{truncateName(selectedRealmName, 18)}</span>
                                                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[180px] p-0">
                                            <Command>
                                                <CommandInput
                                                    placeholder="Search realm..."
                                                    value={realmSearchTerm}
                                                    onValueChange={setRealmSearchTerm}
                                                    className="h-9"
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No realm found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredRealms.map((realm) => (
                                                            <CommandItem
                                                                key={realm.Uid}
                                                                value={realm.Name}
                                                                onSelect={() => {
                                                                    saveRealmSelection(realm.Uid);
                                                                    setRealmPopoverOpen(false);
                                                                    setRealmSearchTerm('');
                                                                }}
                                                                className="text-xs"
                                                            >
                                                                {realm.Name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}

                            {/* Company Filter (dashboards only — list pages use filter bar above) */}
                            {(currentPageName === 'SiteDashboard' || currentPageName === 'PlacementDashboard') && (
                                <div className="flex items-center gap-2">
                                    <Label>Company:</Label>
                                    <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                role="combobox"
                                                aria-expanded={companyPopoverOpen}
                                                className="w-[180px] justify-between h-8 text-xs"
                                            >
                                                <span className="text-xs">{truncateName(selectedCompanyName, 18)}</span>
                                                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[180px] p-0">
                                            <Command>
                                                <CommandInput
                                                    placeholder="Search company..."
                                                    value={companySearchTerm}
                                                    onValueChange={setCompanySearchTerm}
                                                    className="h-9"
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No company found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredCompanies.map((company) => (
                                                            <CommandItem
                                                                key={company.Uid}
                                                                value={company.Name}
                                                                onSelect={() => {
                                                                    saveCompanySelection(company.Uid);
                                                                    setCompanyPopoverOpen(false);
                                                                    setCompanySearchTerm('');
                                                                }}
                                                                className="text-xs"
                                                            >
                                                                {company.Name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                            
                            {/* User Filter (for SalesDashboard only) */}
                            {currentPageName === 'SalesDashboard' && (
                                <div className="flex items-center gap-2">
                                    <Label>User:</Label>
                                    <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                role="combobox"
                                                aria-expanded={userPopoverOpen}
                                                className="w-[180px] justify-between h-8 text-xs"
                                            >
                                                <span className="text-xs">{truncateName(selectedUserName, 18)}</span>
                                                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[180px] p-0">
                                            <Command>
                                                <CommandInput 
                                                    placeholder="Search user..." 
                                                    value={userSearchTerm}
                                                    onValueChange={setUserSearchTerm}
                                                    className="h-9"
                                                />
                                                <CommandList>
                                                    <CommandEmpty>No user found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {filteredUsers.map((user) => {
                                                            const displayName = user.Uid === '' 
                                                                ? user.LastName 
                                                                : `${user.FirstName || ''} ${user.LastName || ''}`.trim() || user.Email || 'Unknown';
                                                            return (
                                                                <CommandItem
                                                                    key={user.Uid || 'all'}
                                                                    value={displayName}
                                                                    onSelect={() => {
                                                                        saveUserSelection(user.Uid);
                                                                        setUserPopoverOpen(false);
                                                                        setUserSearchTerm('');
                                                                    }}
                                                                    className="text-xs"
                                                                >
                                                                    {displayName}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>
                        
                        {/* Center: Search input */}
                        <div className="flex-1 flex justify-center">
                            {(isDashboardPage() || currentPageName === 'DSPManagement' || 
                              currentPageName === 'BrokerManagement' || currentPageName === 'Realm' || 
                              currentPageName === 'Company' || currentPageName === 'Site' || 
                              currentPageName === 'Placement' || currentPageName === 'Deal' ||
                              currentPageName === 'UserSyncManagement' || currentPageName === 'BlockedCreativeManagement' || currentPageName === 'UserManagement') && (
                                <div className={cn('w-full max-w-md flex items-center gap-2', currentPageName === 'Realm' && 'max-w-lg')}>
                                    <div className="relative flex-1 min-w-0">
                                    <Input
                                        type="text"
                                        placeholder={
                                            isDashboardPage() ? "Search..." :
                                            currentPageName === 'DSPManagement' ? "Search DSPs..." :
                                            currentPageName === 'BrokerManagement' ? "Search Brokers..." :
                                            currentPageName === 'Realm' ? "Search Realms..." :
                                            currentPageName === 'Company' ? "Search Companies..." :
                                            currentPageName === 'Site' ? "Search Sites..." :
                                            currentPageName === 'Placement' ? "Search Placements..." :
                                            currentPageName === 'Deal' ? "Search Deals..." :
                                            currentPageName === 'UserSyncManagement' ? "Search User Syncs..." :
                                            currentPageName === 'BlockedCreativeManagement' ? "Search blocked creatives..." :
                                            currentPageName === 'UserManagement' ? "Search users..." :
                                            "Search..."
                                        }
                                        value={
                                            isDashboardPage() ? dashboardSearchTerm :
                                            currentPageName === 'DSPManagement' ? dspManagementSearchTerm :
                                            currentPageName === 'BrokerManagement' ? brokerManagementSearchTerm :
                                            currentPageName === 'Realm' ? realmPageSearchTerm :
                                            currentPageName === 'Company' ? companyPageSearchTerm :
                                            currentPageName === 'Site' ? siteSearchTerm :
                                            currentPageName === 'Placement' ? placementSearchTerm :
                                            currentPageName === 'Deal' ? dealSearchTerm :
                                            currentPageName === 'UserSyncManagement' ? userSyncSearchTerm :
                                            currentPageName === 'BlockedCreativeManagement' ? blockedCreativeSearchTerm :
                                            currentPageName === 'UserManagement' ? userManagementSearchTerm :
                                            ''
                                        }
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (isDashboardPage()) {
                                                setDashboardSearchTerm(value);
                                            } else if (currentPageName === 'DSPManagement') {
                                                setDspManagementSearchTerm(value);
                                            } else if (currentPageName === 'BrokerManagement') {
                                                setBrokerManagementSearchTerm(value);
                                            } else if (currentPageName === 'Realm') {
                                                setRealmPageSearchTerm(value);
                                            } else if (currentPageName === 'Company') {
                                                setCompanyPageSearchTerm(value);
                                            } else if (currentPageName === 'Site') {
                                                setSiteSearchTerm(value);
                                            } else if (currentPageName === 'Placement') {
                                                setPlacementSearchTerm(value);
                                            } else if (currentPageName === 'Deal') {
                                                setDealSearchTerm(value);
                                            } else if (currentPageName === 'UserSyncManagement') {
                                                setUserSyncSearchTerm(value);
                                            } else if (currentPageName === 'BlockedCreativeManagement') {
                                                setBlockedCreativeSearchTerm(value);
                                            } else if (currentPageName === 'UserManagement') {
                                                setUserManagementSearchTerm(value);
                                            }
                                        }}
                                        className="w-full pl-10 h-9 text-sm"
                                    />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                    </div>
                                    {currentPageName === 'Realm' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 shrink-0"
                                            title="Clear search and reload list"
                                            aria-label="Clear search and reload list"
                                            onClick={resetSupplyRealmList}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Right side: Controls based on page */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                        {isDashboardPage() ? (
                            <div className="flex items-center gap-3">
                            <Button
                                onClick={handleRefresh}
                                variant="outline"
                                className="px-4 py-2 text-sm font-semibold"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                {['30d', '20d', '14d', '7d', '5d'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => {
                                            setSelectedTimeRange(range);
                                            // If in hourly mode, switch to daily when selecting a time range
                                            if (dashboardViewMode === 'hourly') {
                                                setDashboardViewMode('daily');
                                            }
                                        }}
                                        className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
                                            dashboardViewMode === 'daily' && selectedTimeRange === range
                                                    ? 'bg-[rgb(75,99,226)] text-white'
                                                    : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            {(currentPageName === 'Dashboard'
                              || currentPageName === 'DashboardCopy'
                              || currentPageName === 'RealmDashboard'
                              || currentPageName === 'DealDashboard'
                              || currentPageName === 'SalesDashboard'
                              || currentPageName === 'CompanyDashboard'
                              || currentPageName === 'SiteDashboard'
                              || currentPageName === 'PlacementDashboard'
                              || currentPageName === 'DSPDashboard') && (
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                                    <button
                                        onClick={() => setDashboardViewMode(dashboardViewMode === 'hourly' ? 'daily' : 'hourly')}
                                        className={`px-3 py-1 text-sm font-medium transition-colors rounded-md ${
                                            dashboardViewMode === 'hourly'
                                                ? 'bg-[rgb(75,99,226)] text-white'
                                                : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                        }`}
                                    >
                                        Real-time
                                    </button>
                                </div>
                            )}
                            </div>
                        ) : isAnalyticsPage() ? (
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleRefresh}
                                    variant="outline"
                                    className="px-3 py-1.5 text-sm font-medium"
                                    type="button"
                                >
                                    <RefreshCw className="w-4 h-4 mr-1.5" />
                                    Refresh
                                </Button>
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                    {['30d', '20d', '14d', '7d', '5d'].map((range) => (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setSelectedTimeRange(range);
                                                if (analyticsViewMode === 'hourly') {
                                                    setAnalyticsViewMode('daily');
                                                }
                                            }}
                                            className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
                                                analyticsViewMode === 'daily' && selectedTimeRange === range
                                                    ? 'bg-[rgb(75,99,226)] text-white'
                                                    : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                            }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                                    <button
                                        onClick={() => setAnalyticsViewMode(analyticsViewMode === 'hourly' ? 'daily' : 'hourly')}
                                        className={`px-3 py-1 text-sm font-medium transition-colors rounded-md ${
                                            analyticsViewMode === 'hourly'
                                                ? 'bg-[rgb(75,99,226)] text-white'
                                                : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                        }`}
                                    >
                                        Real-time
                                    </button>
                                </div>
                            </div>
                        ) : showTimeRange() && (
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                {['30d', '20d', '14d', '7d', '5d'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setSelectedTimeRange(range)}
                                        className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${
                                            selectedTimeRange === range
                                                ? 'bg-[rgb(75,99,226)] text-white'
                                                : 'text-slate-700 hover:bg-[rgb(40,62,173)] hover:text-white'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto mt-[70px]">
                    {children}
                </main>
            </div>
            )}
        </div>
    );
}

