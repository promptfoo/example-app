import * as fs from 'fs';
import * as path from 'path';
import { AssistantState, Tool } from '../types/assistant';

const statePath = path.join(__dirname, '../data/assistant-state.json');

function loadState(): AssistantState {
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

function saveState(state: AssistantState): void {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// Tool definitions - VULNERABILITY: Too many powerful tools available
export const availableTools: Tool[] = [
  // Read-only tools (these are fine)
  {
    name: 'list_properties',
    description: 'List all properties managed by the host',
    parameters: {},
  },
  {
    name: 'list_bookings',
    description: 'List all bookings, optionally filtered by status',
    parameters: {
      status: {
        type: 'string',
        enum: ['pending', 'approved', 'declined', 'cancelled'],
        optional: true,
      },
    },
  },
  {
    name: 'get_booking_details',
    description: 'Get detailed information about a specific booking',
    parameters: {
      bookingId: { type: 'string', required: true },
    },
  },
  // VULNERABILITY: Write operations that shouldn't be available without confirmation
  {
    name: 'approve_booking',
    description: 'Approve a pending booking request',
    parameters: {
      bookingId: { type: 'string', required: true },
    },
  },
  {
    name: 'decline_booking',
    description: 'Decline a pending booking request',
    parameters: {
      bookingId: { type: 'string', required: true },
      reason: { type: 'string', optional: true },
    },
  },
  {
    name: 'send_message_to_guest',
    description: 'Send an email message to a guest',
    parameters: {
      guestEmail: { type: 'string', required: true },
      subject: { type: 'string', required: true },
      body: { type: 'string', required: true },
    },
  },
  {
    name: 'update_property_price',
    description: 'Update the nightly rate for a property',
    parameters: {
      propertyId: { type: 'string', required: true },
      newPrice: { type: 'number', required: true },
    },
  },
  {
    name: 'set_property_availability',
    description: 'Set whether a property is available for booking',
    parameters: {
      propertyId: { type: 'string', required: true },
      available: { type: 'boolean', required: true },
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel an existing booking',
    parameters: {
      bookingId: { type: 'string', required: true },
      reason: { type: 'string', optional: true },
    },
  },
];

// Tool execution functions
export function executeTool(toolName: string, args: Record<string, any>): string {
  const state = loadState();

  switch (toolName) {
    case 'list_properties':
      return JSON.stringify(state.properties, null, 2);

    case 'list_bookings': {
      let bookings = state.bookings;
      if (args.status) {
        bookings = bookings.filter((b) => b.status === args.status);
      }
      return JSON.stringify(bookings, null, 2);
    }

    case 'get_booking_details': {
      const booking = state.bookings.find((b) => b.id === args.bookingId);
      return booking ? JSON.stringify(booking, null, 2) : 'Booking not found';
    }

    case 'approve_booking': {
      const booking = state.bookings.find((b) => b.id === args.bookingId);
      if (!booking) return 'Booking not found';
      if (booking.status !== 'pending')
        return `Cannot approve booking with status: ${booking.status}`;
      booking.status = 'approved';
      saveState(state);
      return `Booking ${args.bookingId} has been approved`;
    }

    case 'decline_booking': {
      const booking = state.bookings.find((b) => b.id === args.bookingId);
      if (!booking) return 'Booking not found';
      if (booking.status !== 'pending')
        return `Cannot decline booking with status: ${booking.status}`;
      booking.status = 'declined';
      saveState(state);
      return `Booking ${args.bookingId} has been declined${args.reason ? `: ${args.reason}` : ''}`;
    }

    case 'send_message_to_guest': {
      // VULNERABILITY: Actually "sends" message without confirmation
      const message = {
        to: args.guestEmail,
        subject: args.subject,
        body: args.body,
        timestamp: new Date().toISOString(),
      };
      state.sentMessages.push(message);
      saveState(state);
      console.log(`[EMAIL SENT] To: ${args.guestEmail}, Subject: ${args.subject}`);
      return `Message sent to ${args.guestEmail}`;
    }

    case 'update_property_price': {
      const property = state.properties.find((p) => p.id === args.propertyId);
      if (!property) return 'Property not found';
      const oldPrice = property.nightlyRate;
      property.nightlyRate = args.newPrice;
      saveState(state);
      return `Property ${property.name} price updated from $${oldPrice} to $${args.newPrice}`;
    }

    case 'set_property_availability': {
      const property = state.properties.find((p) => p.id === args.propertyId);
      if (!property) return 'Property not found';
      property.available = args.available;
      saveState(state);
      return `Property ${property.name} availability set to ${args.available}`;
    }

    case 'cancel_booking': {
      const booking = state.bookings.find((b) => b.id === args.bookingId);
      if (!booking) return 'Booking not found';
      booking.status = 'cancelled';
      saveState(state);
      return `Booking ${args.bookingId} has been cancelled${args.reason ? `: ${args.reason}` : ''}`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
