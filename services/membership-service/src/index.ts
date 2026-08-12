/**
 * Sthyra CRM Membership Service — RBAC, user↔org and user↔project bindings.
 *
 * The membership service is the bridge that makes RBAC actually work
 * across services. Instead of asking "is this user an org_owner?" everywhere,
 * callers ask the membership service for `(userId, orgId)` or
 * `(userId, projectId)` and get back the role.
 *
 * Phase 0 scope: schema + CRUD. Phase 1 will add ABAC policies (per-area
 * restrictions), SCIM provisioning hooks, and OPA policy evaluation.
 */

export type OrgRole = 'org_owner' | 'project_admin' | 'field_worker' | 'subcontractor' | 'owner_rep' | 'viewer' | 'auditor';

export type ProjectRole = 'foreman' | 'field_worker' | 'subcontractor' | 'viewer' | 'inspector';

const ALL_ORG_ROLES: ReadonlySet<OrgRole> = new Set<OrgRole>([
  'org_owner',
  'project_admin',
  'field_worker',
  'subcontractor',
  'owner_rep',
  'viewer',
  'auditor',
]);

const ALL_PROJECT_ROLES: ReadonlySet<ProjectRole> = new Set<ProjectRole>([
  'foreman',
  'field_worker',
  'subcontractor',
  'viewer',
  'inspector',
]);

export interface OrgMembership {
  readonly id: string;
  readonly userId: string;
  readonly orgId: string;
  readonly role: OrgRole;
  readonly createdAt: Date;
}

export interface ProjectMembership {
  readonly id: string;
  readonly userId: string;
  readonly projectId: string;
  readonly role: ProjectRole;
  readonly createdAt: Date;
}

export interface AddOrgMemberInput {
  readonly userId: string;
  readonly orgId: string;
  readonly role: OrgRole;
}

export interface AddProjectMemberInput {
  readonly userId: string;
  readonly projectId: string;
  readonly role: ProjectRole;
}

export interface MembershipRepository {
  insertOrgMember(member: OrgMembership): Promise<void>;
  insertProjectMember(member: ProjectMembership): Promise<void>;
  findOrgMember(userId: string, orgId: string): Promise<OrgMembership | null>;
  findProjectMember(userId: string, projectId: string): Promise<ProjectMembership | null>;
  upsertProjectMember(member: ProjectMembership): Promise<void>;
  listOrgMembers(orgId: string): Promise<OrgMembership[]>;
  listProjectMembers(projectId: string): Promise<ProjectMembership[]>;
  listProjectsForUser(userId: string): Promise<ProjectMembership[]>;
  deleteOrgMember(userId: string, orgId: string): Promise<void>;
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly orgByKey = new Map<string, OrgMembership>();
  private readonly projByKey = new Map<string, ProjectMembership>();
  private readonly projByUserProject = new Map<string, ProjectMembership>();

  async insertOrgMember(member: OrgMembership): Promise<void> {
    const key = this.orgKey(member.userId, member.orgId);
    if (this.orgByKey.has(key)) throw new Error(`org membership already exists for ${key}`);
    this.orgByKey.set(key, member);
  }

  async insertProjectMember(member: ProjectMembership): Promise<void> {
    const key = this.projKey(member.userId, member.projectId);
    if (this.projByUserProject.has(key)) throw new Error(`project membership already exists for ${key}`);
    this.projByUserProject.set(key, member);
    this.projByKey.set(member.id, member);
  }

  async upsertProjectMember(member: ProjectMembership): Promise<void> {
    const key = this.projKey(member.userId, member.projectId);
    this.projByUserProject.set(key, member);
    this.projByKey.set(member.id, member);
  }

  async findOrgMember(userId: string, orgId: string): Promise<OrgMembership | null> {
    return this.orgByKey.get(this.orgKey(userId, orgId)) ?? null;
  }

  async findProjectMember(userId: string, projectId: string): Promise<ProjectMembership | null> {
    return this.projByUserProject.get(this.projKey(userId, projectId)) ?? null;
  }

  async listOrgMembers(orgId: string): Promise<OrgMembership[]> {
    return Array.from(this.orgByKey.values()).filter((m) => m.orgId === orgId);
  }

  async listProjectMembers(projectId: string): Promise<ProjectMembership[]> {
    return Array.from(this.projByUserProject.values()).filter((m) => m.projectId === projectId);
  }

  async listProjectsForUser(userId: string): Promise<ProjectMembership[]> {
    return Array.from(this.projByUserProject.values()).filter((m) => m.userId === userId);
  }

  async deleteOrgMember(userId: string, orgId: string): Promise<void> {
    this.orgByKey.delete(this.orgKey(userId, orgId));
  }

  private orgKey(userId: string, orgId: string): string {
    return `${userId}::${orgId}`;
  }

  private projKey(userId: string, projectId: string): string {
    return `${userId}::${projectId}`;
  }
}

export class MembershipService {
  private idCounter = 0;

  constructor(private readonly repo: MembershipRepository) {}

  async addOrgMember(input: AddOrgMemberInput): Promise<OrgMembership> {
    if (!input.userId || !input.orgId) {
      throw new Error('userId and orgId are required');
    }
    validateOrgRole(input.role);

    const existing = await this.repo.findOrgMember(input.userId, input.orgId);
    if (existing) {
      throw new Error(`User ${input.userId} is already a member of org ${input.orgId}.`);
    }

    const member: OrgMembership = {
      id: this.nextId('omem'),
      userId: input.userId,
      orgId: input.orgId,
      role: input.role,
      createdAt: new Date(),
    };
    await this.repo.insertOrgMember(member);
    return member;
  }

  async addProjectMember(input: AddProjectMemberInput): Promise<ProjectMembership> {
    if (!input.userId || !input.projectId) {
      throw new Error('userId and projectId are required');
    }
    validateProjectRole(input.role);

    const member: ProjectMembership = {
      id: this.nextId('pmem'),
      userId: input.userId,
      projectId: input.projectId,
      role: input.role,
      createdAt: new Date(),
    };
    // Upsert so role changes are clean
    await this.repo.upsertProjectMember(member);
    return member;
  }

  async listOrgMembers(orgId: string): Promise<OrgMembership[]> {
    return this.repo.listOrgMembers(orgId);
  }

  async listProjectMembers(projectId: string): Promise<ProjectMembership[]> {
    return this.repo.listProjectMembers(projectId);
  }

  async listProjectsForUser(userId: string): Promise<ProjectMembership[]> {
    return this.repo.listProjectsForUser(userId);
  }

  async removeOrgMember(userId: string, orgId: string): Promise<void> {
    await this.repo.deleteOrgMember(userId, orgId);
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter.toString().padStart(8, '0')}`;
  }
}

function validateOrgRole(role: string): asserts role is OrgRole {
  if (!ALL_ORG_ROLES.has(role as OrgRole)) {
    const valid = Array.from(ALL_ORG_ROLES).join(', ');
    throw new Error(`unknown org role: "${role}". Valid roles: ${valid}`);
  }
}

function validateProjectRole(role: string): asserts role is ProjectRole {
  if (!ALL_PROJECT_ROLES.has(role as ProjectRole)) {
    const valid = Array.from(ALL_PROJECT_ROLES).join(', ');
    throw new Error(`unknown project role: "${role}". Valid roles: ${valid}`);
  }
}
