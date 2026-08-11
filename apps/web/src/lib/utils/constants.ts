export const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu and Kashmir','Ladakh','Puducherry',
]

export const AMENITY_OPTIONS = [
  'WiFi', 'AC', 'Parking', 'Laundry', 'CCTV', 'Power Backup',
  'Water 24/7', 'Gym', 'Lift', 'Security Guard', 'Attached Bathroom',
  'Geyser', 'TV', 'Refrigerator', 'Study Table', 'Wardrobe',
]

export const ISSUE_CATEGORIES = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PLUMBING',    label: 'Plumbing' },
  { value: 'ELECTRICAL',  label: 'Electrical' },
  { value: 'CLEANLINESS', label: 'Cleanliness' },
  { value: 'SECURITY',    label: 'Security' },
  { value: 'WIFI',        label: 'WiFi / Internet' },
  { value: 'APPLIANCE',   label: 'Appliance' },
  { value: 'NOISE',       label: 'Noise' },
  { value: 'OTHER',       label: 'Other' },
]

export const NOTICE_CATEGORIES = [
  { value: 'MAINTENANCE',   label: 'Maintenance' },
  { value: 'SECURITY',      label: 'Security' },
  { value: 'RENT_REMINDER', label: 'Rent Reminder' },
  { value: 'VISITOR',       label: 'Visitor / Delivery' },
  { value: 'RULE_REMINDER', label: 'House Rules' },
  { value: 'GENERAL',       label: 'General' },
]

export const QUERY_KEYS = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  buildings: {
    all:    ()           => ['buildings'] as const,
    list:   (f?: object) => ['buildings', 'list', f] as const,
    detail: (id: string) => ['buildings', 'detail', id] as const,
    floors: (id: string) => ['buildings', id, 'floors'] as const,
    rooms:  (id: string) => ['buildings', id, 'rooms'] as const,
  },
  tenants: {
    list:   (f?: object) => ['tenants', 'list', f] as const,
    detail: (id: string) => ['tenants', 'detail', id] as const,
  },
  bookings: {
    my:     ()           => ['bookings', 'my'] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  payments: {
    my:           ()           => ['payments', 'my'] as const,
    ownerList:    (f?: object) => ['payments', 'owner', f] as const,
    receipt:      (id: string) => ['payments', 'receipt', id] as const,
  },
  issues: {
    my:           (f?: object) => ['issues', 'my', f] as const,
    myDetail:     (id: string) => ['issues', 'my', id] as const,
    ownerList:    (f?: object) => ['issues', 'owner', f] as const,
  },
  notices: {
    tenant:       (f?: object) => ['notices', 'tenant', f] as const,
    ownerList:    (f?: object) => ['notices', 'owner', f] as const,
  },
  dashboard: {
    owner:  ()           => ['dashboard', 'owner'] as const,
    tenant: ()           => ['dashboard', 'tenant'] as const,
  },
  properties: {
    search: (f?: object) => ['properties', 'search', f] as const,
    detail: (id: string) => ['properties', 'detail', id] as const,
  },
}