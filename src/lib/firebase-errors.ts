'use server';

export class FirebaseUnavailableError extends Error {
  constructor(message = "Firebase credentials not configured") {
    super(message);
    this.name = "FirebaseUnavailableError";
  }
}

export function isFirebaseUnavailableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof FirebaseUnavailableError) {
    return true;
  }

  if (error instanceof Error) {
    return (
      error.message.includes("Firestore has not been initialized") ||
      error.message.includes("Firebase not available") ||
      error.message.includes("credentials not configured") ||
      error.message.includes("Application Default Credentials are not available") ||
      error.message.includes("UNAUTHENTICATED") ||
      error.message.includes("invalid authentication credentials")
    );
  }

  if (typeof error === "string") {
    return (
      error.includes("Firebase not available") ||
      error.includes("credentials not configured") ||
      error.includes("UNAUTHENTICATED") ||
      error.includes("invalid authentication credentials")
    );
  }

  return false;
}
