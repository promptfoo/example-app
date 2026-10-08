export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface Property {
  id: string;
  name: string;
  nightlyRate: number;
  available: boolean;
}

export interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  totalPrice: number;
}

export interface SentMessage {
  to: string;
  subject: string;
  body: string;
  timestamp: string;
}

export interface AssistantState {
  properties: Property[];
  bookings: Booking[];
  sentMessages: SentMessage[];
}
