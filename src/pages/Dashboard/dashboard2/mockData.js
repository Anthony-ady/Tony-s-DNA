/** Mock data for Dashboard 2 prototype (PubMatic-style layout). */

export const KPI_CHART_DATES = ['6/23', '6/24', '6/25', '6/26', '6/27', '6/28', '6/29'];

export const kpiCards = [
  {
    id: 'gross-revenue',
    title: 'Gross Revenue',
    chartType: 'dual',
    series: [
      { key: 'gross', color: '#7eb8e8', data: [32, 38, 42, 40, 45, 48, 46] },
      { key: 'net', color: '#b8a8e8', data: [26, 30, 34, 32, 36, 38, 37] },
    ],
    stats: [
      { label: 'Gross Revenue', value: '$218,027.20', color: 'text-[#3b82c4]' },
      { label: 'Net Revenue', value: '$176,602.00', color: 'text-[#8b7ec8]' },
    ],
    yMax: '$50K',
  },
  {
    id: 'paid-impressions',
    title: 'Paid Impressions',
    chartType: 'single',
    series: [{ key: 'v', color: '#7eb8e8', data: [11, 12, 13, 12.5, 14, 13.5, 12.8] }],
    stats: [
      { label: 'Last 7 Days', value: '85,599,809' },
      { change: -11.12, previous: '96,308,913', previousLabel: 'Previous 7 Days' },
    ],
    yMax: '20M',
  },
  {
    id: 'ecpm',
    title: 'eCPM',
    chartType: 'dual',
    series: [
      { key: 'ecpm', color: '#7eb8e8', data: [2.1, 2.3, 2.5, 2.4, 2.6, 2.55, 2.5] },
      { key: 'netEcpm', color: '#b8a8e8', data: [1.7, 1.85, 2.0, 1.95, 2.1, 2.06, 2.0] },
    ],
    stats: [
      { label: 'eCPM', value: '$2.55', color: 'text-[#3b82c4]' },
      { label: 'Net eCPM', value: '$2.06', color: 'text-[#8b7ec8]' },
    ],
    yMax: '$3',
  },
  {
    id: 'total-requests',
    title: 'Total Requests',
    chartType: 'single',
    series: [{ key: 'v', color: '#7eb8e8', data: [4200, 4800, 5100, 5400, 5800, 5500, 5200] }],
    stats: [
      { label: 'Last 7 Days', value: '35.92B' },
      { change: 25.91, previous: '28.53B', previousLabel: 'Previous 7 Days' },
    ],
    yMax: '6,000M',
  },
  {
    id: 'gross-ecpm',
    title: 'Gross eCPM',
    chartType: 'single',
    series: [{ key: 'v', color: '#7eb8e8', data: [0.0068, 0.0065, 0.0062, 0.006, 0.0058, 0.0061, 0.006] }],
    stats: [
      { label: 'Last 7 Days', value: '$0.0061', valueClass: 'text-red-600' },
      { change: -11.22, previous: '$0.0068', previousLabel: 'Previous 7 Days' },
    ],
    yMax: '$0.01',
  },
  {
    id: 'fill-rate',
    title: 'Fill Rate',
    subtitle: '85,599,809 Monetized | 7.3B Passback',
    chartType: 'single',
    series: [{ key: 'v', color: '#7eb8e8', data: [0.32, 0.3, 0.28, 0.26, 0.25, 0.24, 0.23] }],
    stats: [
      { label: 'Last 7 Days', value: '0.24%' },
      { change: -29.41, previous: '0.34%', previousLabel: 'Previous 7 Days' },
    ],
    yMax: '0.4%',
  },
];

export const adRequestFlow = [
  { stage: 'Total Ad Requests', value: '35.92B', pct: 100 },
  { stage: 'Inventory Matched', value: '28.61B', pct: 79.67 },
  { stage: 'Unique PubMatic Winning Bids', value: '1.73B', pct: 4.81 },
  { stage: 'Paid Impressions', value: '85,599,809.0', pct: 0.24 },
];

export const bidFlow = [
  { stage: 'Bid Requests', value: '57.54B', pct: 100 },
  { stage: 'Non-zero Bids', value: '4.1B', pct: 7.12 },
  { stage: 'Auction Bids', value: '3.62B', pct: 6.28 },
  { stage: 'PubMatic Winning Bids', value: '1.72B', pct: 2.99 },
];

export const topAdRequestFilters = {
  sharePct: 20.33,
  rows: [
    { reason: 'Smart Bid Optimization', yesterday: '1.06B', avg7d: '897.66M', change: 17.77, filtered: '6.28B', pctTotal: 17.49 },
    { reason: 'SCO total node count more than allowed', yesterday: '60,576,080', avg7d: '74,911,166', change: -19.14, filtered: '524.38M', pctTotal: 1.46 },
    { reason: 'Blocked IP addresses', yesterday: '49,507,600', avg7d: '38,415,417', change: 28.87, filtered: '268.91M', pctTotal: 0.75 },
  ],
};

export const topDeals = {
  sharePct: 20.05,
  rows: [
    { name: 'PM_26_Q1_Amazon_Publicis_Kenvue_RON_OLV', yesterday: 988.83, avg7d: 2986.03, change: -66.89, total: 20902.23, pctTotal: 9.59 },
    { name: 'PM_26_Q1_Amazon_Publicis_Kenvue_RON_Display', yesterday: 756.12, avg7d: 2104.5, change: -64.08, total: 14732.18, pctTotal: 6.76 },
    { name: 'PM_26_Q1_Amazon_Publicis_Kenvue_RON_Video', yesterday: 612.45, avg7d: 1890.22, change: -67.6, total: 13201.55, pctTotal: 6.06 },
    { name: 'PM_25_Q4_Amazon_Publicis_Kenvue_RON_OLV', yesterday: 445.9, avg7d: 1203.44, change: -62.95, total: 8412.33, pctTotal: 3.86 },
    { name: 'PM_25_Q4_Amazon_Publicis_Kenvue_RON_Display', yesterday: 398.21, avg7d: 987.65, change: -59.66, total: 6910.12, pctTotal: 3.17 },
  ],
};

export const topDemandSources = {
  sharePct: 99.65,
  rows: [
    { name: 'Amazon DSP', yesterday: 8450.8, avg7d: 21035.6, change: -59.83, total: 147249.23, pctTotal: 67.54 },
    { name: 'DV360', yesterday: 8196.55, avg7d: 7172.95, change: 14.27, total: 50210.64, pctTotal: 23.03 },
    { name: 'Conversant', yesterday: 1003.88, avg7d: 1249.06, change: -19.63, total: 8743.4, pctTotal: 4.01 },
    { name: 'Cognitiv', yesterday: 597.88, avg7d: 520.96, change: 14.76, total: 3646.75, pctTotal: 1.67 },
  ],
};

export const adDistribution = {
  platform: [
    { label: 'Web', gross: 204820.53, net: 165904.64, impressions: 74945263, ecpm: 2.73, netEcpm: 2.21 },
    { label: 'Mobile Web', gross: 10241.87, net: 8295.91, impressions: 8460964, ecpm: 1.21, netEcpm: 0.98 },
    { label: 'Mobile App Android', gross: 2690.88, net: 2179.61, impressions: 1740049, ecpm: 1.55, netEcpm: 1.25 },
    { label: 'Mobile App IOS', gross: 273.87, net: 221.83, impressions: 453522, ecpm: 0.6, netEcpm: 0.49 },
    { label: 'Unknown', gross: 0.05, net: 0, impressions: 11, ecpm: 4.48, netEcpm: 0 },
  ],
  adFormat: [
    { label: 'Display + Video', gross: 124936.12, net: 101198.23, impressions: 53224156, ecpm: 2.35, netEcpm: 1.9 },
    { label: 'Display', gross: 56368.57, net: 45658.54, impressions: 21175204, ecpm: 2.66, netEcpm: 2.16 },
    { label: 'Video', gross: 22476.82, net: 18206.22, impressions: 4732749, ecpm: 4.75, netEcpm: 3.85 },
    { label: 'Display + Native', gross: 11453.32, net: 9277.19, impressions: 5273846, ecpm: 2.17, netEcpm: 1.76 },
    { label: 'Display + Native Video', gross: 2791.14, net: 2260.82, impressions: 1190067, ecpm: 2.35, netEcpm: 1.9 },
    { label: 'Native', gross: 1.22, net: 0.99, impressions: 3787, ecpm: 0.32, netEcpm: 0.26 },
  ],
  channel: [
    { label: 'Open Exchange', gross: 145727.4, net: 118039.16, impressions: 64590836, ecpm: 2.26, netEcpm: 1.83 },
    { label: 'PMP', gross: 72299.8, net: 58562.84, impressions: 20998999, ecpm: 3.44, netEcpm: 2.79 },
  ],
};
