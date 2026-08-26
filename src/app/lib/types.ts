export type UserRole = 'admin' | 'it_staff' | 'management' | 'department_user';

export interface AppUser {
  uid: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  location: string;
  createdAt: string;
  active: boolean;
}

export type AssetStatus = 'Available' | 'Assigned' | 'Under Repair' | 'For Replacement' | 'Disposed' | 'Missing' | 'Borrowed';
export type AssetLocation = 'KK' | 'KP' | 'PH';

export type AssetCategory =
  | 'Laptop'
  | 'Desktop'
  | 'Monitor'
  | 'Printer'
  | 'Scanner'
  | 'UPS'
  | 'Router'
  | 'Switch'
  | 'Access Point'
  | 'Walkie-Talkie'
  | 'MOTOTRBO'
  | 'Company Phone'
  | 'Toner/Ink'
  | 'Cable/Adapter'
  | 'Software License'
  | 'Starlink'
  | 'Network Equipment'
  | 'Server/NAS'
  | 'Other';

export interface Asset {
  id: string;
  assetId: string;
  category: AssetCategory;
  brand: string;
  model: string;
  serialNumber: string;
  location: AssetLocation;
  department: string;
  assignedUser: string;
  status: AssetStatus;
  purchaseDate: string;
  warrantyExpiry: string;
  supplier: string;
  cost: number;
  remarks: string;
  photoUrl: string;
  invoiceUrl: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Assignment {
  id: string;
  assetId: string;
  assetName: string;
  assetCategory: string;
  assignedTo: string;
  department: string;
  location: AssetLocation;
  dateIssued: string;
  conditionIssued: string;
  returnedDate: string;
  conditionReturned: string;
  handoverFormUrl: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export type MaintenanceStatus = 'Good' | 'Need Monitoring' | 'Need Repair' | 'Completed' | 'Pending';

export interface Maintenance {
  id: string;
  assetId: string;
  assetName: string;
  assetCategory: string;
  maintenanceDate: string;
  technician: string;
  checklist: Record<string, boolean>;
  status: MaintenanceStatus;
  nextMaintenance: string;
  remarks: string;
  attachmentUrl: string;
  createdAt: string;
  createdBy: string;
}

export interface Repair {
  id: string;
  assetId: string;
  assetName: string;
  date: string;
  issue: string;
  action: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  technician: string;
  cost: number;
  remarks: string;
  createdAt: string;
  createdBy: string;
}

export interface StockItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  minimumStock: number;
  location: string;
  supplier: string;
  lastRestockDate: string;
  cost: number;
  remarks: string;
  createdAt: string;
  createdBy: string;
}

export interface SoftwareLicense {
  id: string;
  softwareName: string;
  vendor: string;
  licenseType: string;
  billingCycle: 'Monthly' | 'Annually' | 'One-time' | '';
  billingInterval?: number;
  users: number;
  expiryDate: string;
  cost: number;
  supplier: string;
  renewalReminderDays: number;
  licenseKey: string;
  assignedTo: string;
  remarks: string;
  invoiceUrl: string;
  terminated: boolean;
  terminatedDate: string;
  createdAt: string;
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  target: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: 'warranty' | 'license' | 'stock' | 'maintenance';
  title: string;
  message: string;
  severity: 'warning' | 'critical' | 'info';
  relatedId: string;
  createdAt: string;
}
