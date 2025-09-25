// Utility functions for sanitizing user input
export function sanitizeForLog(input: unknown): string {
  if (typeof input !== 'string') {
    input = String(input);
  }
  return (input as string)
    .replace(/[\r\n]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .substring(0, 200);
}

export function isValidUrl(url: string, allowedHosts: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    if (allowedHosts.length > 0) {
      return allowedHosts.includes(parsed.hostname);
    }
    // Block private IPs and localhost
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname === '169.254.169.254') {
      return false;
    }
    return ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}