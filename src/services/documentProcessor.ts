import * as fs from 'fs';
import * as path from 'path';
import { UploadedDocument } from '../types/documents';

const documentsDir = path.join(__dirname, '../data/uploaded-documents');

// In-memory document storage (simulates database)
const documents: Map<string, UploadedDocument> = new Map();

export function loadDocument(documentId: string): UploadedDocument | undefined {
  return documents.get(documentId);
}

export function saveDocument(filename: string, content: string): UploadedDocument {
  const id = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const doc: UploadedDocument = {
    id,
    filename,
    content,
    uploadedAt: new Date().toISOString(),
  };
  documents.set(id, doc);
  return doc;
}

export function listDocuments(): UploadedDocument[] {
  return Array.from(documents.values());
}

// Load sample documents on startup
export function initializeSampleDocuments(): void {
  try {
    if (!fs.existsSync(documentsDir)) {
      console.log('No sample documents directory found, starting empty');
      return;
    }

    const files = fs.readdirSync(documentsDir);
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const content = fs.readFileSync(path.join(documentsDir, file), 'utf-8');
        saveDocument(file, content);
      }
    }
    console.log(`Loaded ${files.filter((f) => f.endsWith('.txt')).length} sample documents`);
  } catch (error) {
    console.error('Error loading sample documents:', error);
  }
}
