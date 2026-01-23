import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'bookings.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE owners (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    api_key TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE properties (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    nightly_rate REAL NOT NULL,
    owner_id INTEGER REFERENCES owners(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE bookings (
    id INTEGER PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'confirmed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert sample data
db.exec(`
  INSERT INTO owners (name, email, api_key) VALUES
    ('John Smith', 'john@example.com', 'sk-owner-secret-key-12345'),
    ('Jane Doe', 'jane@example.com', 'sk-owner-secret-key-67890');

  INSERT INTO properties (name, address, nightly_rate, owner_id) VALUES
    ('Beach House', '123 Ocean Dr, Miami, FL', 250.00, 1),
    ('Mountain Cabin', '456 Pine Rd, Aspen, CO', 175.00, 1),
    ('City Apartment', '789 Main St, New York, NY', 150.00, 2);

  INSERT INTO bookings (property_id, guest_name, guest_email, check_in, check_out, total_price, status) VALUES
    (1, 'Alice Johnson', 'alice@email.com', '2024-01-15', '2024-01-20', 1250.00, 'completed'),
    (1, 'Bob Williams', 'bob@email.com', '2024-02-01', '2024-02-05', 1000.00, 'confirmed'),
    (2, 'Carol Brown', 'carol@email.com', '2024-01-10', '2024-01-14', 700.00, 'completed'),
    (2, 'David Lee', 'david@email.com', '2024-02-15', '2024-02-18', 525.00, 'confirmed'),
    (3, 'Eve Wilson', 'eve@email.com', '2024-01-20', '2024-01-22', 300.00, 'completed'),
    (3, 'Frank Miller', 'frank@email.com', '2024-02-10', '2024-02-14', 600.00, 'cancelled'),
    (1, 'Grace Taylor', 'grace@email.com', '2024-03-01', '2024-03-07', 1500.00, 'pending'),
    (2, 'Henry Davis', 'henry@email.com', '2024-03-05', '2024-03-08', 525.00, 'pending');
`);

console.log('Analytics database initialized successfully at:', dbPath);
console.log('Tables created: owners, properties, bookings');
console.log('Sample data inserted: 2 owners, 3 properties, 8 bookings');

db.close();
