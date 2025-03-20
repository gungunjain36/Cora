export type Message = {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
};

export type PolicyCard = {
  id: string;
  name: string;
  coverage: string;
  premium: string;
  status: "Active" | "Pending" | "Expired";
  details?: {
    label: string;
    value: string;
  }[];
};

export type ChatSession = {
  session_id: string;
  user_id: string;
  messages: {
    id: string;
    sender: string;
    text: string;
    timestamp: string;
  }[];
  created_at: string;
  updated_at: string;
}; 