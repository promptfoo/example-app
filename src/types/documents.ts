export interface UploadedDocument {
  id: string;
  filename: string;
  content: string;
  uploadedAt: string;
  propertyId?: string;
}

export interface ListingGenerationRequest {
  documentId: string;
  propertyName: string;
  sendToEmail?: string;
}

export interface GeneratedListing {
  title: string;
  description: string;
  highlights: string[];
  generatedAt: string;
}
