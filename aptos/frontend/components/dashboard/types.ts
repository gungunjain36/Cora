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
}; 