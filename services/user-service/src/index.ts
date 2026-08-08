/**
 * Plumb User Service — identity, RBAC, OIDC-shaped tokens.
 *
 * Phase 0 scope: schema, provision/lookup, opaque token issuance + verification.
 * Phase 1 will add real OIDC (Auth0/Okta/Entra), SAML SSO, SCIM provisioning,
 * MFA, session policy — the interface below is designed so those swap in
 * without breaking callers.
 *
 * The token format is `opaque:<hex>` (not a JWT). Phase 1 will swap the
 * TokenStore for one backed by Redis and add JWT/SVID issuance per the
 * SPIFFE/SPIRE choice in the master plan.
 */

import { randomBytes, createHash } from 'node:crypto';

export type Role = 'org_owner' | 'project_admin' | 'field_worker' | 'subcontractor' | 'owner_rep' | 'viewer' | 'auditor';

const ALL_ROLES: ReadonlySet<Role> = new Set<Role>([
  'org_owner',
  'project_admin',
  'field_worker',
  'subcontractor',
  'owner_rep',
  'viewer',
  'auditor',
]);

export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly orgId: string;
  readonly createdAt: Date;
}

export interface ProvisionInput {
  readonly email: string;
  readonly displayName: string;
  readonly role: Role;
  readonly orgId: string;
}

export interface UserRepository {
  insert(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string, orgId: string): Promise<User | null>;
}

export interface TokenStore {
  store(tokenHash: string, payload: StoredToken, ttlSeconds: number): Promise<void>;
  lookup(tokenHash: string): Promise<StoredToken | null>;
  revoke(tokenHash: string): Promise<void>;
}

export interface StoredToken {
  readonly userId: string;
  readonly orgId: string;
  readonly role: Role;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface VerifiedToken {
  readonly userId: string;
  readonly orgId: string;
  readonly role: Role;
}

export interface UserServiceOptions {
  users: UserRepository;
  tokens: TokenStore;
  tokenTtlSeconds: number;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();
  private readonly byKey = new Map<string, string>(); // `${orgId}::${email}` -> id

  async insert(user: User): Promise<void> {
    if (this.byId.has(user.id)) throw new Error(`user id collision: ${user.id}`);
    this.byId.set(user.id, user);
    this.byKey.set(`${user.orgId}::${user.email.toLowerCase()}`, user.id);
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(email: string, orgId: string): Promise<User | null> {
    const id = this.byKey.get(`${orgId}::${email.toLowerCase()}`);
    return id ? (this.byId.get(id) ?? null) : null;
  }
}

export class InMemoryTokenStore implements TokenStore {
  private readonly data = new Map<string, { payload: StoredToken; expiresAt: number }>();

  async store(tokenHash: string, payload: StoredToken, _ttlSeconds: number): Promise<void> {
    this.data.set(tokenHash, { payload, expiresAt: payload.expiresAt });
  }

  async lookup(tokenHash: string): Promise<StoredToken | null> {
    const entry = this.data.get(tokenHash);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.data.delete(tokenHash);
      return null;
    }
    return entry.payload;
  }

  async revoke(tokenHash: string): Promise<void> {
    this.data.delete(tokenHash);
  }
}

export class UserService {
  private idCounter = 0;

  constructor(private readonly opts: UserServiceOptions) {}

  async provision(input: ProvisionInput): Promise<User> {
    validateEmail(input.email);
    validateDisplayName(input.displayName);
    validateRole(input.role);
    validateOrgId(input.orgId);

    const existing = await this.opts.users.findByEmail(input.email, input.orgId);
    if (existing) {
      throw new Error(`A user with email "${input.email}" already exists in org "${input.orgId}".`);
    }

    const user: User = {
      id: this.nextId(),
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      role: input.role,
      orgId: input.orgId,
      createdAt: new Date(),
    };
    await this.opts.users.insert(user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.opts.users.findById(id);
  }

  async issueToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.opts.users.findById(userId);
    if (!user) throw new Error(`user not found: ${userId}`);

    const opaque = randomBytes(32).toString('hex');
    const token = `opaque:${opaque}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const issuedAt = Date.now();
    const expiresAt = issuedAt + this.opts.tokenTtlSeconds * 1000;

    await this.opts.tokens.store(
      tokenHash,
      { userId: user.id, orgId: user.orgId, role: user.role, issuedAt, expiresAt },
      this.opts.tokenTtlSeconds,
    );

    return { token, expiresAt: new Date(expiresAt) };
  }

  async verifyToken(token: string): Promise<VerifiedToken | null> {
    if (!token.startsWith('opaque:')) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const stored = await this.opts.tokens.lookup(tokenHash);
    if (!stored) return null;
    return { userId: stored.userId, orgId: stored.orgId, role: stored.role };
  }

  async revokeToken(token: string): Promise<void> {
    if (!token.startsWith('opaque:')) return;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.opts.tokens.revoke(tokenHash);
  }

  private nextId(): string {
    this.idCounter += 1;
    return `usr_${this.idCounter.toString().padStart(8, '0')}`;
  }
}

function validateEmail(email: string): void {
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('email must be a non-empty string');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`invalid email: "${email}"`);
  }
}

function validateDisplayName(name: string): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('displayName must be a non-empty string');
  }
}

function validateRole(role: string): asserts role is Role {
  if (!ALL_ROLES.has(role as Role)) {
    const valid = Array.from(ALL_ROLES).join(', ');
    throw new Error(`unknown role: "${role}". Valid roles: ${valid}`);
  }
}

function validateOrgId(orgId: string): void {
  if (typeof orgId !== 'string' || orgId.trim().length === 0) {
    throw new Error('orgId must be a non-empty string');
  }
}
