export class ConsentManager {
  private readonly grantedOrigins = new Set<string>();

  isGranted(origin: string): boolean {
    return this.grantedOrigins.has(origin);
  }

  grant(origin: string): void {
    this.grantedOrigins.add(origin);
  }

  revoke(origin: string): void {
    this.grantedOrigins.delete(origin);
  }

  getGrantedOrigins(): string[] {
    return [...this.grantedOrigins];
  }

  clear(): void {
    this.grantedOrigins.clear();
  }
}
