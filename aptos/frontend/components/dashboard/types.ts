export type Detail = {
  label: string;
  value: string;
};

export type PolicyCard = {
  id: string;
  name: string;
  coverage: string;
  premium: string;
  status: "Active" | "Pending" | "Expired";
  details: Detail[];
  lastUpdate?: string;
  image?: string;
  colorAccent?: string;
  paymentDue?: boolean;
  paymentDueDate?: string;
  premiumAmount?: number;
  txHash?: string;
  policyCreationDate?: string;
  nextPaymentAmount?: number;
};

export type Message = {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
  isPolicyRecommendation?: boolean;
  policyId?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  lastModified: Date;
  messages: Message[];
};

// CSS animation keyframes - to be added to global styles
export const ANIMATION_KEYFRAMES = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-out forwards;
}

.animate-slideInRight {
  animation: slideInRight 0.5s ease-out forwards;
}

.animate-slideInLeft {
  animation: slideInLeft 0.5s ease-out forwards;
}

.animate-pulse {
  animation: pulse 2s infinite ease-in-out;
}

.shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.03) 100%);
  background-size: 1000px 100%;
  animation: shimmer 2s infinite linear;
}
`;

// Theme colors
export const THEME = {
  primary: "#3CB371", // Medium Sea Green (Cora Primary)
  secondary: "#8A2BE2", // Blue Violet (Cora Secondary)
  dark: "#0d1117", // Dark background
  light: "#F8F9FA", // Light text
  gray: "#6C757D", // Gray text
  success: "#198754", // Success green
  warning: "#FFC107", // Warning yellow
  danger: "#DC3545", // Danger red
  info: "#0DCAF0", // Info blue
}; 