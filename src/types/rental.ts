export interface PreviousAddress {
  address: string;
  residenceType: string;
  duration: string;
  landlordName: string;
  landlordPhone?: string;
  monthlyRent: number;
  notes?: string;
}

export interface CriminalRecord {
  type: string;
  offense: string;
  date: string;
  location: string;
  disposition: string;
  sentence?: string;
}

export interface GuestReview {
  propertyName: string;
  rating: number;
  hostReview: string;
  date: string;
}

export interface GuestApplication {
  applicationId: string;
  propertyId: string;
  propertyName: string;
  status: string;
  submittedAt: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  profilePhotoUrl: string;
  memberSince: string;
  platformId: string;
  verified: boolean;
  verifiedId: boolean;
  verifiedPhone: boolean;
  verifiedEmail: boolean;
  superguest: boolean;
  totalReviews: number;
  averageRating: number;
  responseRate: string;
  responseTime: string;
  previousBookings: number;
  cancellationRate: string;
  checkIn: string;
  checkOut: string;
  numberOfGuests: number;
  numberOfNights: number;
  nightlyRate: number;
  totalPrice: number;
  bookingPurpose: string;
  guestMessage: string;
  houseRulesAcknowledged: boolean;
  houseRulesTimestamp: string;
  cancellationPolicyAccepted: string;
  ssn: string;
  driversLicenseNumber: string;
  driversLicenseState: string;
  driversLicenseExpiration: string;
  driversLicenseImageUrl: string;
  dateOfBirth: string;
  idVerificationFrontImage: string;
  idVerificationBackImage: string;
  idVerificationSelfie: string;
  idVerificationStatus: string;
  idVerifiedAt: string;
  creditScore: number;
  creditProvider: string;
  creditCheckDate: string;
  creditDelinquencies: number;
  creditCollections: number;
  creditBankruptcies: number;
  creditUtilization: string;
  creditAccountsGoodStanding: number;
  creditOldestAccount: string;
  creditRecentInquiries: number;
  backgroundCheckProvider: string;
  backgroundCheckDate: string;
  backgroundCheckStatus: string;
  backgroundCheckReportId: string;
  criminalRecords: CriminalRecord[];
  sexOffenderRegistry: boolean;
  evictionRecords: any[];
  employer: string;
  jobTitle: string;
  employedSince: string;
  annualIncome: number;
  employmentVerified: boolean;
  employmentVerificationDate: string;
  currentAddress: string;
  currentResidenceType: string;
  currentResidenceDuration: string;
  currentLandlordName: string;
  currentLandlordPhone: string;
  currentMonthlyRent: number;
  previousAddresses: PreviousAddress[];
  paymentType: string;
  paymentCardLast4: string;
  paymentCardType: string;
  paymentCardExpiration: string;
  paymentBillingZip: string;
  securityDepositAccountType: string;
  securityDepositBankName: string;
  securityDepositAccountNumber: string;
  securityDepositRoutingNumber: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
  emergencyContactAddress: string;
  reviews: GuestReview[];
}

export interface GuestApplicationDatabase {
  applications: GuestApplication[];
}
